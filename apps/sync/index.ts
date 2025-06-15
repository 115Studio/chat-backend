import { DurableObject } from 'cloudflare:workers'
import { verifyJwt } from '../../libs/crypto/jwt'
import { EventEnvironment, HonoEnvironment } from '../../environment'
import { DbInstance, initDbConnect } from '../../libs/db/init'
import { Hono } from 'hono'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { StreamMessageUpdate } from '../../libs/ai/send-message'

import {
  BYOK,
  Channel,
  Message,
  messagesTable,
  MessageStage,
  MessageStages,
  Personality,
  syncedMessagesTable,
  User,
  usersTable,
} from '../../libs/db/schema'
import { WebSocketOpCode } from '../../libs/constants/web-socket-op-code'
import { AiReturnType } from '../../libs/constants/ai-return-type'
import { MessageState } from '../../libs/constants/message-state'
import { eq } from 'drizzle-orm'
import { askAi } from '../../libs/ai/ask-ai'
import { MessageStageType } from '../../libs/constants/message-stage-type'
import { AiMessage, messageToAi } from '../../libs/ai/message-to-ai'
import { getSystemPrompt } from '../../libs/ai/get-system-prompt'
import { z } from 'zod'
import { MessageStageContentType } from '../../libs/constants/message-stage-content-type'
import { snowflake } from '../../libs/utils/snowflake'

export interface WebSocketMeta {
  userId: string
  sessionId: string
}

export interface SyncedMessage {
  stages: MessageStages
  channelId: string
}

const syncedMessageDto = z.object({
  stages: z.array(
    z.object({
      id: z.string(),
      type: z.nativeEnum(MessageStageType),
      content: z.object({
        type: z.nativeEnum(MessageStageContentType),
        value: z.string(),
      }),
    }),
  ),
  channelId: z.string(),
})

export class UserDo extends DurableObject<EventEnvironment> {
  private sessions: Map<WebSocket, { meta: WebSocketMeta }>
  private db: DbInstance
  private messages: Map<string, MessageStages> = new Map()

  private syncedMessage?: Map<string, SyncedMessage[]> = new Map()
  private syncingTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(ctx: DurableObjectState, env: EventEnvironment) {
    super(ctx, env)

    this.sessions = new Map()

    this.db = initDbConnect(env)

    const websockets = this.ctx.getWebSockets()

    for (const ws of websockets) {
      const meta = ws.deserializeAttachment()

      if (!meta) {
        this.webSocketClose(ws, 1006)
      }

      this.sessions.set(ws, meta)
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const jwt = url.searchParams.get('auth')

    if (!jwt) {
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = await verifyJwt(this.env.JWT_SECRET, jwt)

    if (!payload) {
      return new Response('Invalid JWT', { status: 403 })
    }

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(server)

    const attachment = { meta: { userId: payload.id, sessionId: snowflake() } }

    server.serializeAttachment(attachment)
    this.sessions.set(server, attachment)

    this.serverHello(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  // async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
  //   // console.log(this.sessions.entries())
  //   const user = this.sessions.get(ws)?.meta.userId!
  //   this.broadcastMessage(user, `User: ${user}, Echo: ${message}, clients: ${this.sessions.size}`)
  // }

  // async heartbeat() {
  //   this.sessions.forEach((s, ws) => {
  //     ws.send(JSON.stringify({ op: WebSocketOpCode.Heartbeat, data: { ts: Date.now() } }))
  //   })
  // }

  async serverHello(ws: WebSocket) {
    const user = this.sessions.get(ws)?.meta.userId!

    const [[userData], inputs] = await this.db.batch([
      this.db.select().from(usersTable).where(eq(usersTable.id, user)),
      this.db
        .select({
          stages: syncedMessagesTable.stages,
          channelId: syncedMessagesTable.channelId,
        })
        .from(syncedMessagesTable)
        .where(eq(syncedMessagesTable.userId, user)),
    ])

    if (!userData) {
      this.webSocketClose(ws, 1006)
      return
    }

    ws.send(
      JSON.stringify({
        op: WebSocketOpCode.ServerHello,
        data: {
          user: {
            id: userData.id,
            name: userData.name,
            defaultModel: userData.defaultModel,
            displayModels: userData.displayModels,
          },
          inputs,
          ts: Date.now(),
        },
      }),
    )
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const { userId, sessionId } = this.sessions.get(ws)?.meta!

    const parsed = typeof message === 'string' ? JSON.parse(message) : message

    if (parsed.op === WebSocketOpCode.SyncInput) {
      const { stages, channelId } = syncedMessageDto.parse(parsed.data)

      await this.syncMessage(userId, sessionId, {
        stages,
        channelId,
      })
    }
  }

  async syncMessage(userId: string, sessionId: string, message: SyncedMessage) {
    if (!this.syncedMessage) this.syncedMessage = new Map()
    if (!this.syncedMessage.has(userId)) this.syncedMessage.set(userId, [message])

    const timeout = this.syncingTimeouts.get(userId)
    if (timeout) clearTimeout(timeout)

    this.syncingTimeouts.set(
      userId,
      setTimeout(async () => {
        await this.saveSyncedMessage(userId, message)

        this.syncingTimeouts.delete(userId)
      }, 5000),
    )

    this.broadcastMessage(
      userId,
      {
        op: WebSocketOpCode.SyncInput,
        data: message,
      },
      [sessionId],
    )
  }

  saveSyncedMessage(userId: string, message: SyncedMessage) {
    return this.db
      .insert(syncedMessagesTable)
      .values({
        userId,
        channelId: message.channelId,
        stages: message.stages,
      })
      .onConflictDoUpdate({
        target: [syncedMessagesTable.userId, syncedMessagesTable.channelId],
        set: {
          stages: message.stages,
        },
      })
  }

  broadcastMessage(userId: string, message: any, skipSessions: string[] = []) {
    if (typeof message !== 'string') message = JSON.stringify(message)

    this.sessions.forEach((session, ws) => {
      try {
        if (session.meta.userId === userId && !skipSessions.includes(session.meta.sessionId)) ws.send(message)
      } catch (e) {
        this.sessions.delete(ws)
      }
    })
  }

  webSocketClose(ws: WebSocket, code: number) {
    this.sessions.delete(ws)

    try {
      ws.close(code, 'Durable Object is closing WebSocket')
    } catch (e) {
      console.error(e)
    }
  }

  ackChannelCreate(userId: string, channel: Channel) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.ChannelCreate,
      data: { channel },
    })
  }

  ackChannelUpdate(userId: string, channel: Channel) {
    console.log('ackChannelUpdate', userId, channel.id)
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.ChannelUpdate,
      data: { channel },
    })
  }

  ackChannelDelete(userId: string, channelId: string) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.ChannelDelete,
      data: { channelId },
    })
  }

  ackMessageCreate(userId: string, message: Message) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageCreate,
      data: { message },
    })
  }

  ackMessageUpdate(userId: string, message: Message) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageUpdate,
      data: { message },
    })
  }

  ackMessageComplement(userId: string, messageId: string, chunk: string, ts: number) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageComplement,
      data: { messageId, chunk, ts },
    })
  }

  ackMessageStageUpdate(
    userId: string,
    messageId: string,
    channelId: string,
    stageUpdate: StreamMessageUpdate,
    ts: number,
  ) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageStageUpdate,
      data: { messageId, channelId, stageUpdate, ts },
    })
  }

  ackMessageDelete(userId: string, messageId: string) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageDelete,
      data: { messageId },
    })
  }

  ackUserUpdate(userId: string, user: User) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.UserUpdate,
      data: { user },
    })
  }

  ackPersonalityCreated(userId: string, personality: Personality) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.PersonalityCreated,
      data: { personality },
    })
  }

  ackPersonalityUpdated(userId: string, personality: Personality) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.PersonalityUpdated,
      data: { personality },
    })
  }

  ackPersonalityDeleted(userId: string, personalityId: string) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.PersonalityDeleted,
      data: { personalityId },
    })
  }

  ackBYOKCreated(userId: string, byok: Omit<BYOK, 'key'>) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.BYOKCreated,
      data: { byok },
    })
  }

  ackBYOKUpdated(userId: string, byok: Omit<BYOK, 'key'>) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.BYOKUpdated,
      data: { byok },
    })
  }

  ackBYOKDeleted(userId: string, byokId: string) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.BYOKDeleted,
      data: { byokId },
    })
  }

  async complementMessage(
    userId: string,
    messageId: string,
    channelId: string,
    current: Message,
    history: Message[],
    personalityPrompt: string | undefined,
    byoks: BYOK[] = [],
  ): Promise<MessageStages | undefined> {
    const messages: AiMessage[] = [
      {
        role: 'system',
        content: getSystemPrompt(personalityPrompt),
      },
      ...history.map(messageToAi),
    ]

    const stream = await askAi<AiReturnType.Stream>(
      this.env,
      current.model,
      messages,
      userId,
      byoks,
      AiReturnType.Stream,
    )

    if (!stream) {
      const [msg] = await this.db
        .update(messagesTable)
        .set({ state: MessageState.Failed })
        .where(eq(messagesTable.id, messageId))
        .returning()
        .execute()

      this.ackMessageUpdate(userId, msg)

      return
    }

    this.messages.set(messageId, [])

    const reader = stream.getReader()
    let ts = Date.now()
    let lastSaveTime = Date.now()
    const SAVE_INTERVAL = 3000 // 3 seconds

    const stages = new Map<string, MessageStage>()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      ts = Date.now()

      if (!value) continue

      this.ackMessageStageUpdate(userId, messageId, channelId, value, ts)

      let stage = stages.get(value.id)

      if (!stage) {
        stage = value
        stages.set(value.id, stage)
      }

      switch (stage.type) {
        case MessageStageType.Text:
        case MessageStageType.Think:
          if (!value.content.value) continue

          if (stage.content) {
            stage.content.value += value.content.value
          } else {
            stage.content = value.content
          }
          break
        default:
          stage.content = value.content
      }

      this.messages.set(messageId, Array.from(stages.values()))

      if (ts - lastSaveTime >= SAVE_INTERVAL) {
        await this.db
          .update(messagesTable)
          .set({
            stages: this.messages.get(messageId) || [],
            updatedAt: ts,
          })
          .where(eq(messagesTable.id, messageId))
          .execute()

        lastSaveTime = ts
      }
    }

    const [msg] = await this.db
      .update(messagesTable)
      .set({
        state: MessageState.Completed,
        stages: Array.from(stages.values()),
        updatedAt: ts,
      })
      .where(eq(messagesTable.id, messageId))
      .returning()
      .execute()

    this.ackMessageUpdate(userId, msg)

    this.messages.delete(messageId)

    return msg.stages
  }

  getIncompleteMessage(messageId: string): MessageStages | undefined {
    return this.messages.get(messageId)
  }
}

const app = new Hono<HonoEnvironment>()

app.get('/connection', async (c) => {
  const jwt = c.req.query('auth')

  if (!jwt) {
    throw makeError(ErrorCode.Unauthorized, 401)
  }

  const payload = await verifyJwt(c.env.JWT_SECRET, jwt)

  if (!payload) {
    throw makeError(ErrorCode.AuthorizationFailed, 403)
  }

  const doId = c.env.USER_DURABLE_OBJECT.idFromName(payload.id)
  const doInstance = c.env.USER_DURABLE_OBJECT.get(doId)

  return doInstance.fetch(c.req.raw)
})

export default app
