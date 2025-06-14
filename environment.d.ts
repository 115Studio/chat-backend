import { Env } from 'hono'
import { env } from 'hono/adapter'
import { Context } from 'hono'
import { UserDo } from './apps'

type HonoEnvironment = Env & {
  Bindings: {
    DB: D1Database
    KV: KVNamespace

    R2: R2Bucket
    // You can use http://127.0.0.1:8787/api/v1/images as the local CDN endpoint
    CDN_ENDPOINT: string
    // CDN host, e.g. cdn.example.com. Without any protocol or trailing slash.
    CDN_HOST: string

    USER_DURABLE_OBJECT: DurableObjectNamespace<UserDo>

    JWT_SECRET: string
    AES_KEY: string

    DISCORD_CLIENT_ID: string
    DISCORD_CLIENT_SECRET: string

    ANTHROPIC_AUTH?: string
    GOOGLE_AI_AUTH?: string
    OPENAI_AUTH?: string
  }
}

type EventEnvironment = ReturnType<
  typeof env<Record<string, unknown>, Context<HonoEnvironment>>
>
