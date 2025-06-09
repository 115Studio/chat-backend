import { Hono } from 'hono'
import { EventEnvironment, HonoEnvironment } from '../../environment'
import z from 'zod/v4'
import { zValidator } from '@hono/zod-validator'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { snowflake } from '../../libs/utils/snowflake'
import { AiModel } from '../../libs/constants/ai-model'
import { getDo } from '../../libs/utils/get-do'
import { DbInstance, initDbConnect } from '../../libs/db/init'
import { Channel, channelsTable, Message, messagesTable } from '../../libs/db/schema'
import { MagicNumber } from '../../libs/constants/magic-number'
import { and, eq, gt, lt, desc, ne, inArray } from 'drizzle-orm'
import { MessageState } from '../../libs/constants/message-state'
import { MessageRole } from '../../libs/constants/message-role'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { AiReturnType } from '../../libs/constants/ai-return-type'
import { askAi } from '../../libs/ai/ask-ai'
import { AiMessage } from '../../libs/ai/send-message'
import { UserDo } from '../sync'
import { JwtPayload } from '../../libs/crypto/jwt'
import { zResponse } from '../../libs/utils/z-response'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

const createMessageDto = z.object({
  content: z.string().min(1).max(1000),
  model: z.enum(AiModel)
})

const getMessagesDto = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().min(25).max(100).default(50)
})

app.post(
  '/:id/messages',
  zValidator('json', createMessageDto, zResponse),
  async (c) => {
    const db = initDbConnect(c.env)

    const { content, model } = c.req.valid('json')

    const jwt = c.get('jwt')

    const { doStub } = getDo(c.env, c.var.jwt.id)

    let channelId = c.req.param('id')
    const isNew = channelId === '@new'

    let channels: Channel[] = []

    if (isNew) {
      channelId = snowflake()

      channels = await db
        .insert(channelsTable)
        .values({
          id: channelId,
          name: `${MagicNumber.NameShowSkeleton}`,
          ownerId: jwt.id,
          createdAt: Date.now()
        })
        .onConflictDoNothing()
        .returning()
        .execute()
    } else {
      channels = await db
        .select()
        .from(channelsTable)
        .where(
          and(
            eq(channelsTable.id, channelId),
            eq(channelsTable.ownerId, jwt.id)
          )
        )
        .execute()
    }

    const channel = channels[0]

    if (!channel) {
      throw makeError(ErrorCode.UnknownChannel, 404)
    }

    let history: Message[] = []

    if (!isNew) {
      history = await db
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.id, channelId),
            eq(messagesTable.userId, jwt.id)
          )
        )
        .limit(25)
        .execute()
    }

    const lastMessage = history[history.length - 1]

    if (
      lastMessage &&
      lastMessage.state !== MessageState.Completed &&
      lastMessage.state !== MessageState.Failed
    ) {
      throw makeError(ErrorCode.RateLimitExceeded, 429)
    }

    const userMessageId = snowflake(),
      systemMessageId = snowflake()

    const [ [ userMessage ], [ systemMessage ] ] = await db.batch([
      db
        .insert(messagesTable)
        .values({
          id: userMessageId,
          groupId: userMessageId,
          channelId,
          userId: jwt.id,

          state: MessageState.Completed,
          role: MessageRole.User,
          model,

          content,

          createdAt: Date.now()
        })
        .returning(),
      db
        .insert(messagesTable)
        .values({
          id: systemMessageId,
          groupId: systemMessageId,
          channelId,
          userId: jwt.id,

          state: MessageState.Created,
          role: MessageRole.Assistant,
          model,

          createdAt: Date.now() + 1
        })
        .returning()
    ])

    history.push(userMessage)

    c.executionCtx.waitUntil(
      completeMessageCreate(
        c.env,
        db,
        channel,
        jwt,
        content,
        systemMessage,
        userMessage,
        history,
        isNew,
        doStub
      )
    )

    return c.json({
      channelId,
      channel,
      userMessage,
      systemMessage
    })
  })

async function completeMessageCreate(
  env: EventEnvironment,
  db: DbInstance,
  channel: Channel,
  jwt: JwtPayload,
  content: string,
  systemMessage: Message,
  userMessage: Message,
  history: Message[],
  isNew: boolean,
  doStub: DurableObjectStub<UserDo>
) {
  if (isNew) {
    await doStub.ackChannelCreate(jwt.id, channel)

    const summarizeSystemMessage: AiMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant. Your task is to summarize the message and provide ` +
          `a response based on the user's message with ONLY 1-3 words long. Always use the same language as the user. ` +
          `Do not include any additional information or explanations. ` +
          `If the conversation is empty, just respond with "New chat"`
      },
      {
        role: 'user',
        content,
      }
    ]

    const newName = await askAi<AiReturnType.Complete>(
      env, AiModel.GoogleGemini20Flash, summarizeSystemMessage, AiReturnType.Complete
    ) ?? 'New chat'

    const [ newChannel ] = await db
      .update(channelsTable)
      .set({ name: newName.trim() })
      .where(eq(channelsTable.id, channel.id))
      .returning()
      .execute()

    await doStub.ackChannelUpdate(jwt.id, newChannel)
  }

  await doStub.ackMessageCreate(jwt.id, userMessage)
  await doStub.ackMessageCreate(jwt.id, systemMessage)

  return doStub.complementMessage(jwt.id, systemMessage.id, userMessage, history)
}

app.get(
  '/:id/messages',
  zValidator('query', getMessagesDto, zResponse),
  async (c) => {
    const db = initDbConnect(c.env)
    const jwt = c.get('jwt')
    const channelId = c.req.param('id')
    const { from, to, limit } = c.req.valid('query')

    const channels = await db
      .select()
      .from(channelsTable)
      .where(
        and(
          eq(channelsTable.id, channelId),
          eq(channelsTable.ownerId, jwt.id)
        )
      )
      .execute()

    const channel = channels[0]
    if (!channel) {
      throw makeError(ErrorCode.UnknownChannel, 404)
    }

    const conditions = [eq(messagesTable.channelId, channelId)]

    if (from) {
      const fromMessage = await db
        .select({ createdAt: messagesTable.createdAt })
        .from(messagesTable)
        .where(eq(messagesTable.id, from))
        .execute()

      if (fromMessage[0]) {
        conditions.push(gt(messagesTable.createdAt, fromMessage[0].createdAt))
      }
    }

    if (to) {
      const toMessage = await db
        .select({ createdAt: messagesTable.createdAt })
        .from(messagesTable)
        .where(eq(messagesTable.id, to))
        .execute()

      if (toMessage[0]) {
        conditions.push(lt(messagesTable.createdAt, toMessage[0].createdAt))
      }
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(and(...conditions))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit)
      .execute()

    const { doStub } = getDo(c.env, jwt.id)

    const messagesToUpdate: string[] = []
    const updatedMessages: Message[] = []

    for (const m of messages) {
      if (m.role === MessageRole.Assistant && m.state !== MessageState.Completed && m.state !== MessageState.Failed) {
        const txt = await doStub.getIncompleteMessage(m.id)

        if (txt) {
          m.content = txt
          m.updatedAt = Date.now()
        } else {
          m.state = MessageState.Completed
          messagesToUpdate.push(m.id)
        }
      }

      updatedMessages.push(m)
    }

    if (messagesToUpdate.length) {
      await db
        .update(messagesTable)
        .set({ state: MessageState.Completed })
        .where(
          inArray(messagesTable.id, messagesToUpdate)
        )
        .execute()
    }

    return c.json({
      messages: updatedMessages.reverse()
    })
  }
)

export default app
