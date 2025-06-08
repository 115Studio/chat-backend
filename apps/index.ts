import { Hono } from 'hono'
import { HonoEnvironment } from '../environment'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { ErrorCode, errorMessages } from '../libs/constants/errors'

import users from './users'

const app = new Hono<HonoEnvironment>()

app.use('/*', cors())

app.onError((err, ctx) => {
  if (err instanceof HTTPException) {
    return ctx.json({ success: false, error: err.message }, err.status ?? 500)
  }

  console.error(err)

  return ctx.json({ error: `[${ErrorCode.UnknownError}] ${errorMessages[ErrorCode.UnknownError]}` }, 500)
})

app.get('/', (c) => c.text('Nothing here!'))

app.route('/users', users)

export default app
