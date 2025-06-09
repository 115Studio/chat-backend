import { DurableObject } from 'cloudflare:workers'
import { verifyJwt } from '../../libs/crypto/jwt'
import { EventEnvironment, HonoEnvironment } from '../../environment'
import { DbInstance, initDbConnect } from '../../libs/db/init'
import { Hono } from 'hono'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { sendMessage } from '../../libs/ai/send-message'
import { AiModel } from '../../libs/constants/ai-model'

export interface WebSocketMeta {
  userId: string
}

export class UserDo extends DurableObject<EventEnvironment> {
  private sessions: Map<WebSocket, { meta: WebSocketMeta }>
  private db: DbInstance

  constructor(ctx: DurableObjectState, env: EventEnvironment) {
    super(ctx, env)

    this.sessions = new Map()

    this.db = initDbConnect(env)

    const websockets = this.ctx.getWebSockets()

    for (const ws of websockets) {
      const meta = ws.deserializeAttachment() as WebSocketMeta

      if (!meta) {
        this.webSocketClose(ws, 1006)
      }

      this.sessions.set(ws, { meta })
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

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    console.log(this.sessions.entries())
    const user = this.sessions.get(ws)?.meta.userId!
    this.broadcastMessage(user, `User: ${user}, Echo: ${message}, clients: ${this.sessions.size}`)
  }

  broadcastMessage(userId: string, message: string) {
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

    ws.close(code, 'Durable Object is closing WebSocket')
  }

  async askAi(userId: string, messageId: string, content: string) {
    const stream = await sendMessage(
      this.env.AI.gateway('chat-prod'),
      'haha',
      AiModel.AnthropicClaudeSonnet4,
      [ { role: 'user', content } ]
    )

    if (!stream) return

    const decoder = new TextDecoder()

    // subscribe to stream and broadcast every update
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true })
      this.broadcastMessage(userId, text)
    }
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
