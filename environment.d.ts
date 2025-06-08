import { Env } from 'hono'
import { env } from 'hono/adapter'
import { Context } from 'hono'

type HonoEnvironment = Env & {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
    R2: R2Bucket
  }
}

type EventEnvironment = ReturnType<
  typeof env<Record<string, unknown>, Context<HonoEnvironment>>
>
