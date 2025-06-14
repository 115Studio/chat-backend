import { DurableObject } from 'cloudflare:workers'
import { verifyJwt } from '../../libs/crypto/jwt'
import { EventEnvironment, HonoEnvironment } from '../../environment'
import { DbInstance, initDbConnect } from '../../libs/db/init'
import { Hono } from 'hono'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { StreamMessageUpdate } from '../../libs/ai/send-message'

import { Channel, Message, messagesTable, MessageStage, MessageStages } from '../../libs/db/schema'
import { WebSocketOpCode } from '../../libs/constants/web-socket-op-code'
import { AiReturnType } from '../../libs/constants/ai-return-type'
import { MessageState } from '../../libs/constants/message-state'
import { eq } from 'drizzle-orm'
import { askAi } from '../../libs/ai/ask-ai'
import { snowflake } from '../../libs/utils/snowflake'
import { MessageStageType } from '../../libs/constants/message-stage-type'
import { MessageStageContentType } from '../../libs/constants/message-stage-content-type'
import { AiMessage, messageToAi } from '../../libs/ai/message-to-ai'

export interface WebSocketMeta {
  userId: string
}

export class UserDo extends DurableObject<EventEnvironment> {
  private sessions: Map<WebSocket, { meta: WebSocketMeta }>
  private db: DbInstance
  private messages: Map<string, MessageStages> = new Map()

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

    const attachment = { meta: { userId: payload.id } }

    server.serializeAttachment(attachment)
    this.sessions.set(server, attachment)

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

  async heartbeat() {
    this.sessions.forEach((s, ws) => {
      ws.send(JSON.stringify({ op: WebSocketOpCode.Heartbeat, data: { ts: Date.now() } }))
    })
  }

  broadcastMessage(userId: string, message: any) {
    if (typeof message !== 'string') message = JSON.stringify(message)

    this.sessions.forEach((session, ws) => {
      try {
        if (session.meta.userId === userId) ws.send(message)
      } catch (e) {
        this.sessions.delete(ws)
      }
    })
  }

  webSocketClose(
    ws: WebSocket,
    code: number,
  ) {
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
      data: { channel }
    })
  }

  ackChannelUpdate(userId: string, channel: Channel) {
    console.log('ackChannelUpdate', userId, channel.id)
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.ChannelUpdate,
      data: { channel }
    })
  }

  ackChannelDelete(userId: string, channelId: string) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.ChannelDelete,
      data: { channelId }
    })
  }

  ackMessageCreate(userId: string, message: Message) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageCreate,
      data: { message }
    })
  }

  ackMessageUpdate(userId: string, message: Message) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageUpdate,
      data: { message }
    })
  }

  ackMessageComplement(userId: string, messageId: string, chunk: string, ts: number) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageComplement,
      data: { messageId, chunk, ts }
    })
  }

  ackMessageStageUpdate(userId: string, messageId: string, stageUpdate: StreamMessageUpdate, ts: number) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageStageUpdate,
      data: { messageId, stageUpdate, ts }
    })
  }

  ackMessageDelete(userId: string, messageId: string) {
    this.broadcastMessage(userId, {
      op: WebSocketOpCode.MessageDelete,
      data: { messageId }
    })
  }

  async complementMessage(
    userId: string, messageId: string, current: Message, history: Message[]
  ): Promise<MessageStages | undefined> {
    const messages: AiMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant with access to tools for image generation (generate_image), web search (web_search_preview), and file analysis. Use these tools when appropriate to provide comprehensive and helpful responses.'
      },
      ...history.map(messageToAi),
    ]

    const stream = await askAi<AiReturnType.Stream>(this.env, current.model, messages, userId, AiReturnType.Stream)

    if (!stream) {
      const [ msg ] = await this.db
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

      this.ackMessageStageUpdate(userId, messageId, value, ts)

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

    const [ msg ] = await this.db
      .update(messagesTable)
      .set({
        state: MessageState.Completed,
        stages: Array.from(stages.values()),
        updatedAt: ts
      })
      .where(eq(messagesTable.id, messageId))
      .returning()
      .execute()

    this.messages.delete(messageId)

    this.ackMessageUpdate(userId, msg)

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
