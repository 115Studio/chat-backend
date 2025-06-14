import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { z } from 'zod'
import { AiModel } from '../../libs/constants/ai-model'
import { zValidator } from '@hono/zod-validator'
import { zResponse } from '../../libs/utils/z-response'
import { initDbConnect } from '../../libs/db/init'
import { usersTable } from '../../libs/db/schema'
import { eq } from 'drizzle-orm'
import { getDo } from '../../libs/utils/get-do'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

const updateUserDto = z.object({
  defaultModel: z.nativeEnum(AiModel).optional(),
  displayModels: z.array(z.nativeEnum(AiModel)).optional(),
})

app.patch('/update', zValidator('json', updateUserDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const userId = c.get('jwt')?.id

  const { defaultModel, displayModels } = c.req.valid('json')

  const [user] = await db
    .update(usersTable)
    .set({
      defaultModel: defaultModel,
      displayModels: displayModels,
    })
    .where(eq(usersTable.id, userId))
    .returning()

  if (!user) throw makeError(ErrorCode.UnknownUser, 404)

  const { doStub } = getDo(c.env, userId)

  await doStub.ackUserUpdate(userId, user)

  return c.json({ status: true, user })
})

export default app
