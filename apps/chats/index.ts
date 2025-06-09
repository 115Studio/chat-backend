import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import z from 'zod/v4'
import { zValidator } from '@hono/zod-validator'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { snowflake } from '../../libs/utils/snowflake'

const app = new Hono<HonoEnvironment & JwtVariable>()

const askAiDto = z.object({
  content: z.string().min(1).max(1000),
})

app.post(
  '/ask',
  checkJwt,
  zValidator('json', askAiDto),
  async (c) => {
    const { content } = c.req.valid('json')

    const jwt = c.get('jwt')

    const doId = c.env.USER_DURABLE_OBJECT.idFromName(jwt.id)
    const doInstance = c.env.USER_DURABLE_OBJECT.get(doId)

    const messageId = snowflake()

    void doInstance.askAi(jwt.id, messageId, content)

    return c.json({
      success: true,
      messageId,
    })
  })

export default app
