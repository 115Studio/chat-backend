import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import z from 'zod/v4'
import { zValidator } from '@hono/zod-validator'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { deconstructSnowflake, snowflake } from '../../libs/utils/snowflake'
import { AiModel } from '../../libs/constants/ai-model'
import { getDo } from '../../libs/utils/get-do'
import { initDbConnect } from '../../libs/db/init'
import {
  BYOKTable,
  Channel,
  channelsTable,
  Message,
  messagesTable,
  MessageStage,
  MessageStages,
  ModelSettings,
  personalityTable,
  uploadsTable,
} from '../../libs/db/schema'
import { MagicNumber } from '../../libs/constants/magic-number'
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm'
import { MessageState } from '../../libs/constants/message-state'
import { MessageRole } from '../../libs/constants/message-role'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { zResponse } from '../../libs/utils/z-response'
import { MessageStageType } from '../../libs/constants/message-stage-type'
import { MessageStageContentType } from '../../libs/constants/message-stage-content-type'
import { AiModelFlag } from '../../libs/constants/ai-model-flag'
import { stagesToFeatures } from '../../libs/ai/stages-to-features'
import { modelToFeatures } from '../../libs/ai/model-to-features'
import { completeMessageCreate } from './complete-message-create'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

const createMessageDto = z.object({
  stages: z.array(
    z.object({
      type: z.enum(MessageStageType),
      content: z.object({
        type: z.enum(MessageStageContentType),
        value: z.string().min(1).max(1000),
      }),
    }),
  ),
  model: z.object({
    id: z.enum(AiModel),
    key: z.string().optional(),
    flags: z.array(z.enum(AiModelFlag)),
  }),
  personalityId: z.string().optional(),
})

const getMessagesDto = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().min(25).max(100).default(50),
})

app.get('/:id/messages', zValidator('query', getMessagesDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')
  const channelId = c.req.param('id')
  const { from, to, limit } = c.req.valid('query')

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(and(eq(channelsTable.id, channelId), eq(channelsTable.ownerId, jwt.id)))
    .execute()

  if (!channel) {
    throw makeError(ErrorCode.UnknownChannel, 404)
  }

  const conditions = [eq(messagesTable.channelId, channelId)]

  if (from) {
    const fromMessageCreatedAt = deconstructSnowflake(from).timestamp

    if (fromMessageCreatedAt) {
      conditions.push(gt(messagesTable.createdAt, fromMessageCreatedAt))
    }
  }

  if (to) {
    const toMessageCreatedAt = deconstructSnowflake(to).timestamp

    if (toMessageCreatedAt) {
      conditions.push(lt(messagesTable.createdAt, toMessageCreatedAt))
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
      const stages = await doStub.getIncompleteMessage(m.id)

      if (stages) {
        m.stages = stages
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
      .where(inArray(messagesTable.id, messagesToUpdate))
      .execute()
  }

  return c.json({
    messages: updatedMessages.reverse(),
  })
})

app.post('/:id/messages', zValidator('json', createMessageDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)

  let { stages: stagesRaw, model, personalityId } = c.req.valid('json')
  model = model satisfies ModelSettings

  const stageFeatures = stagesToFeatures(stagesRaw as MessageStages)
  const modelFeatures = modelToFeatures(model.id)

  if (!modelFeatures.some((f) => stageFeatures.includes(f))) {
    throw makeError(ErrorCode.UnsupportedModelFeatures, 400)
  }

  const jwt = c.get('jwt')

  const allowedUserStages = [
    MessageStageType.Text,
    MessageStageType.Vision,
    MessageStageType.Pdf,
    MessageStageType.File,
    MessageStageType.Audio,
  ]

  const urlStages = [MessageStageType.Vision, MessageStageType.Pdf, MessageStageType.File, MessageStageType.Audio]

  const filesStages: typeof stagesRaw = []
  const stages: Required<MessageStages> = []

  for (const stage of stagesRaw) {
    if (!allowedUserStages.includes(stage.type)) {
      throw makeError(ErrorCode.BadRequest, 400)
    }

    const isUrl = urlStages.includes(stage.type)

    if (isUrl) {
      filesStages.push(stage)
    } else {
      ;(stage as MessageStage).id = snowflake()
      stages.push(stage as Required<MessageStage>)
    }
  }

  const uploads = filesStages.length
    ? await db
        .select()
        .from(uploadsTable)
        .where(
          and(
            eq(uploadsTable.userId, jwt.id),
            inArray(
              uploadsTable.id,
              filesStages.map((s) => s.content.value),
            ),
          ),
        )
        .execute()
    : []

  for (const stage of filesStages) {
    const upload = uploads.find((u) => u.id === stage.content.value)

    if (!upload) {
      throw makeError(ErrorCode.UnknownUpload, 404)
    }

    if (upload.userId !== jwt.id) {
      throw makeError(ErrorCode.UnknownUpload, 404)
    }

    switch (stage.type) {
      case MessageStageType.Vision:
        if (!upload.mime.includes('image/')) throw makeError(ErrorCode.UploadTypeMismatch, 400)
        break

      case MessageStageType.Pdf:
        if (!upload.mime.includes('application/pdf')) throw makeError(ErrorCode.UploadTypeMismatch, 400)
        break

      case MessageStageType.File:
        if (!upload.mime.includes('text/plain')) throw makeError(ErrorCode.UploadTypeMismatch, 400)
        break

      case MessageStageType.Audio:
        if (!upload.mime.includes('audio/')) throw makeError(ErrorCode.UploadTypeMismatch, 400)
        break
    }

    stage.content.value = upload.url
    ;(stage as MessageStage).id = snowflake()

    stages.push(stage as Required<MessageStage>)
  }

  const { doStub } = getDo(c.env, c.var.jwt.id)

  let channelId = c.req.param('id')
  const isNew = channelId === '@new'

  let channels: Channel[]

  if (isNew) {
    channelId = snowflake()

    channels = await db
      .insert(channelsTable)
      .values({
        id: channelId,
        name: `${MagicNumber.NameShowSkeleton}`,
        ownerId: jwt.id,
        createdAt: Date.now(),
      })
      .onConflictDoNothing()
      .returning()
      .execute()
  } else {
    channels = await db
      .select()
      .from(channelsTable)
      .where(and(eq(channelsTable.id, channelId), eq(channelsTable.ownerId, jwt.id)))
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
      .where(and(eq(messagesTable.channelId, channelId), eq(messagesTable.userId, jwt.id)))
      .limit(25)
      .execute()
  }

  const lastMessage = history[history.length - 1]

  if (lastMessage && lastMessage.state !== MessageState.Completed && lastMessage.state !== MessageState.Failed) {
    throw makeError(ErrorCode.RateLimitExceeded, 429)
  }

  const userMessageId = snowflake(),
    systemMessageId = snowflake()

  const [[userMessage], [systemMessage]] = await db.batch([
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
        stages,

        createdAt: Date.now(),
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

        stages: [],

        createdAt: Date.now() + 1,
      })
      .returning(),
    db
      .update(channelsTable)
      .set({
        updatedAt: Date.now(),
      })
      .where(eq(channelsTable.id, channelId)),
  ])

  history.push(userMessage)

  const [personality] = personalityId
    ? await db
        .select()
        .from(personalityTable)
        .where(and(eq(personalityTable.id, personalityId), eq(personalityTable.userId, jwt.id)))
        .execute()
    : []

  const byoks = await db.select().from(BYOKTable).where(eq(BYOKTable.userId, jwt.id)).execute()

  c.executionCtx.waitUntil(
    completeMessageCreate(
      c.env,
      db,
      channel,
      jwt,
      stages,
      systemMessage,
      userMessage,
      history,
      isNew,
      personality?.prompt,
      byoks,
      doStub,
    ),
  )

  return c.json({
    channelId,
    channel,
    userMessage,
    systemMessage,
  })
})
export default app
