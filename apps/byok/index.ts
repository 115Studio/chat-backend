import { Hono } from 'hono'
import { EventEnvironment, HonoEnvironment } from '../../environment'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { initDbConnect } from '../../libs/db/init'
import { BYOKTable } from '../../libs/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import z from 'zod'
import { AiModel } from '../../libs/constants/ai-model'
import { zResponse } from '../../libs/utils/z-response'
import { zValidator } from '@hono/zod-validator'
import { snowflake } from '../../libs/utils/snowflake'
import { getDo } from '../../libs/utils/get-do'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { decryptAes, encryptAes } from '../../libs/crypto/aes'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

const createByokDTO = z.object({
  name: z.string().min(1).max(100),
  key: z.string().min(1).max(500),
  models: z.array(z.nativeEnum(AiModel)).min(1),
})

const updateByokDTO = z.object({
  name: z.string().min(1).max(100).optional(),
  key: z.string().min(1).max(500).optional(),
  models: z.array(z.nativeEnum(AiModel)).min(1).optional(),
})

app.get('/', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const byoks = await db
    .select({
      id: BYOKTable.id,
      name: BYOKTable.name,
      models: BYOKTable.models,
      createdAt: BYOKTable.createdAt,
      updatedAt: BYOKTable.updatedAt,
    })
    .from(BYOKTable)
    .where(eq(BYOKTable.userId, jwt.id))
    .execute()

  return c.json({ connections: byoks })
})

app.post('/', zValidator('json', createByokDTO, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { name, key, models } = c.req.valid('json')

  const existingByok = await db.select().from(BYOKTable).where(eq(BYOKTable.userId, jwt.id)).execute()
  const allUsedModels = existingByok.flatMap((byok) => byok.models)

  if (models.some((e) => allUsedModels.includes(e))) throw makeError(ErrorCode.BYOKModelAlreadyUsed, 400)

  const [byok] = await db
    .insert(BYOKTable)
    .values({
      id: snowflake(),
      userId: jwt.id,
      name,
      key: await encryptByokKey(c.env, key),
      models,
      createdAt: Date.now(),
      updatedAt: null,
    })
    .returning()

  const byokWithoutKey = {
    ...byok,
    key: undefined,
  }

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackBYOKCreated(jwt.id, byokWithoutKey))

  return c.json({ status: true, byok: byokWithoutKey })
})

app.patch('/:id', zValidator('json', updateByokDTO, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { id } = c.req.param()

  const { name, key, models } = c.req.valid('json')

  if (models) {
    const existingByok = await db
      .select()
      .from(BYOKTable)
      .where(and(eq(BYOKTable.userId, jwt.id), ne(BYOKTable.id, id)))
      .execute()
    const allUsedModels = existingByok.flatMap((byok) => byok.models)

    if (models.some((e) => allUsedModels.includes(e))) throw makeError(ErrorCode.BYOKModelAlreadyUsed, 400)
  }

  const [byok] = await db
    .update(BYOKTable)
    .set({
      name,
      key: key ? await encryptByokKey(c.env, key) : undefined,
      models,
      updatedAt: Date.now(),
    })
    .where(and(eq(BYOKTable.id, id), eq(BYOKTable.userId, jwt.id)))
    .returning()

  if (!byok) throw makeError(ErrorCode.BYOKNotFound, 404)

  const byokWithoutKey = {
    ...byok,
    key: undefined,
  }

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackBYOKUpdated(jwt.id, byokWithoutKey))

  return c.json({ status: true, byok: byokWithoutKey })
})

app.delete('/:id', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { id } = c.req.param()

  const [byok] = await db
    .delete(BYOKTable)
    .where(and(eq(BYOKTable.id, id), eq(BYOKTable.userId, jwt.id)))
    .returning()

  if (!byok) throw makeError(ErrorCode.BYOKNotFound, 404)

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackBYOKDeleted(jwt.id, id))

  return c.json({ status: true })
})

async function encryptByokKey(e: EventEnvironment, text: string) {
  const { data, iv } = await encryptAes(e, text)

  return `${iv}::${data}`
}

export async function decryptByokKey(e: EventEnvironment, encrypted: string) {
  const [iv, data] = encrypted.split('::')
  if (!iv || !data) {
    throw makeError(ErrorCode.InvalidBYOKKey, 400)
  }

  return await decryptAes(e, {
    iv,
    data,
  })
}

export default app
