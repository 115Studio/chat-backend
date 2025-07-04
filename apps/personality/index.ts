import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { initDbConnect } from '../../libs/db/init'
import { personalityTable } from '../../libs/db/schema'
import { and, eq, ne } from 'drizzle-orm'
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
  isDefault: z.boolean().default(false),
})

const UpdatePersonalityDto = z.object({
  name: z.string().min(1).max(100).optional(),
  prompt: z.string().min(1).max(1000).optional(),
  isDefault: z.boolean().optional(),
})

app.get('/', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const personalities = await db
    .select({
      id: personalityTable.id,
      name: personalityTable.name,
      isDefault: personalityTable.isDefault,
      createdAt: personalityTable.createdAt,
      updatedAt: personalityTable.updatedAt,
    })
    .from(personalityTable)
    .where(eq(personalityTable.userId, jwt.id))
    .execute()

  return c.json({ personalities })
})

app.get(':id', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')
  const { id } = c.req.param()

  const [personality] = await db
    .select()
    .from(personalityTable)
    .where(and(eq(personalityTable.id, id), eq(personalityTable.userId, jwt.id)))
    .execute()

  if (!personality) throw makeError(ErrorCode.PersonalityNotFound, 404)

  return c.json({ personality })
})

app.post('/', zValidator('json', CreatePersonalityDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { name, prompt, isDefault } = c.req.valid('json')

  const [personality] = await db
    .insert(personalityTable)
    .values({
      id: snowflake(),
      userId: jwt.id,
      name,
      prompt,
      isDefault,
      createdAt: Date.now(),
      updatedAt: null,
    })
    .returning()

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(
    Promise.all([
      doStub.ackPersonalityCreated(jwt.id, personality),
      isDefault
        ? await db
            .update(personalityTable)
            .set({
              isDefault: false,
            })
            .where(
              and(
                eq(personalityTable.userId, jwt.id),
                eq(personalityTable.isDefault, true),
                ne(personalityTable.id, personality.id),
              ),
            )
            .execute()
        : undefined,
    ]),
  )

  return c.json({ personality })
})

app.patch(':id', zValidator('json', UpdatePersonalityDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')
  const { id } = c.req.param()

  const { name, prompt, isDefault } = c.req.valid('json')

  const [personality] = await db
    .update(personalityTable)
    .set({
      name,
      prompt,
      isDefault,
      updatedAt: Date.now(),
    })
    .where(and(eq(personalityTable.id, id), eq(personalityTable.userId, jwt.id)))
    .returning()

  if (!personality) throw makeError(ErrorCode.PersonalityNotFound, 404)

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(
    Promise.all([
      doStub.ackPersonalityUpdated(jwt.id, personality),
      isDefault
        ? await db
            .update(personalityTable)
            .set({
              isDefault: false,
            })
            .where(
              and(
                eq(personalityTable.userId, jwt.id),
                eq(personalityTable.isDefault, true),
                ne(personalityTable.id, personality.id),
              ),
            )
            .execute()
        : undefined,
    ]),
  )

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
