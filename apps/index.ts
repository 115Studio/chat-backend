import { Hono } from 'hono'
import { HonoEnvironment } from '../environment'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { ErrorCode, errorMessages } from '../libs/constants/errors'

import oauth from './oauth'
import users from './users'
import sync, { UserDo } from './sync'
import chats from './chats'

const app = new Hono<HonoEnvironment>()//.basePath('/v1')

app.use(cors())

app.onError((err, ctx) => {
  if (err instanceof HTTPException) {
    return ctx.json({ success: false, error: err.message }, err.status ?? 500)
  }

  console.error(err)

  return ctx.json({ error: `[${ErrorCode.UnknownError}] ${errorMessages[ErrorCode.UnknownError]}` }, 500)
})

app.get('/', (c) => c.text('Nothing here!'))

app.route('/chats', chats)
app.route('/oauth', oauth)
app.route('/users', users)
app.route('/sync', sync)

export default app

export { UserDo }
