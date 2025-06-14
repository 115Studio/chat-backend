import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { initDbConnect } from '../../libs/db/init'
import { personalityTable } from '../../libs/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { zResponse } from '../../libs/utils/z-response'
import { snowflake } from '../../libs/utils/snowflake'
import { getDo } from '../../libs/utils/get-do'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

const CreatePersonalityDto = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(1000),
})

const UpdatePersonalityDto = z.object({
  name: z.string().min(1).max(100).optional(),
  prompt: z.string().min(1).max(1000).optional(),
  default: z.boolean().optional(),
})

app.get('/', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const personalities = await db.select().from(personalityTable).where(eq(personalityTable.userId, jwt.id)).execute()

  return c.json({ personalities })
})

app.post('/', zValidator('json', CreatePersonalityDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { name, prompt } = c.req.valid('json')

  const [defaultPersonality] = await db
    .select()
    .from(personalityTable)
    .where(and(eq(personalityTable.userId, jwt.id), eq(personalityTable.default, true)))
    .execute()

  let personality = null

  try {
    const [dbPersonality] = await db
      .insert(personalityTable)
      .values({
        id: snowflake(),
        userId: jwt.id,
        name,
        prompt,
        default: !defaultPersonality,
        createdAt: Date.now(),
        updatedAt: null,
      })
      .returning()

    personality = dbPersonality
  } catch (e: any) {
    if (e instanceof Error && e.cause?.toString().includes('UNIQUE constraint'))
      throw makeError(ErrorCode.PersonalityNameIsClaimed, 409)

    console.error(e)
    throw makeError(ErrorCode.UnknownError, 500)
  }

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackPersonalityCreated(jwt.id, personality))

  return c.json({ personality })
})

app.patch(':id', zValidator('json', UpdatePersonalityDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')
  const { id } = c.req.param()

  const { name, prompt, default: isDefault } = c.req.valid('json')

  let personality = null

  try {
    const [dbPersonality] = await db
      .update(personalityTable)
      .set({
        name,
        prompt,
        default: isDefault,
        updatedAt: Date.now(),
      })
      .where(and(eq(personalityTable.id, id), eq(personalityTable.userId, jwt.id)))
      .returning()

    personality = dbPersonality
  } catch (e: any) {
    if (e instanceof Error && e.cause?.toString().includes('UNIQUE constraint'))
      throw makeError(ErrorCode.PersonalityNameIsClaimed, 409)

    throw e
  }

  if (!personality) throw makeError(ErrorCode.PersonalityNotFound, 404)

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackPersonalityUpdated(jwt.id, personality))

  return c.json({ personality })
})

app.delete(':id', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')
  const { id } = c.req.param()

  const [personality] = await db
    .delete(personalityTable)
    .where(and(eq(personalityTable.id, id), eq(personalityTable.userId, jwt.id)))
    .returning()

  if (!personality) throw makeError(ErrorCode.PersonalityNotFound, 404)

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackPersonalityDeleted(jwt.id, id))

  return c.json({ success: true })
})

export default app
