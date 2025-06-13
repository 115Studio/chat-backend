import { Context, Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { fileExtension } from '../../libs/utils/file-extension'
import { bodyLimit } from 'hono/body-limit'
import { ErrorCode } from '../../libs/constants/errors'
import { makeError, makeTextError } from '../../libs/utils/make-error'
import { initDbConnect } from '../../libs/db/init'
import { uploadsTable, usersTable } from '../../libs/db/schema'
import { and, count, eq, gte } from 'drizzle-orm'
import { UserPlan } from '../../libs/constants/user-plan'
import { sha1 } from '../../libs/utils/sha1'
import { snowflake } from '../../libs/utils/snowflake'
import { slashEnded } from '../../libs/utils/slash-ended'
import { fileMime } from '../../libs/utils/file-mime'
import z from 'zod/v4'
import { zValidator } from '@hono/zod-validator'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

const onError = (c: Context) => {
  return c.text(makeTextError(ErrorCode.UploadTooLarge), 413)
}

const uploadDto = z.object({
  sha: z.string().length(40)
})

app.get('/exists', zValidator('query', uploadDto), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')
  const { sha } = c.req.valid('query')

  const [ file ] = await db
    .select()
    .from(uploadsTable)
    .where(
      and(
        eq(uploadsTable.userId, jwt.id), eq(uploadsTable.sha, sha)
      )
    )
    .execute()

  if (file) {
    return c.json(file)
  }

  return c.json({ exists: false }, 404)
})

app.post(
  '/uploads',
  bodyLimit({ maxSize: 8 * 1024 * 1024, onError }),
  async (c) => {
    const db = initDbConnect(c.env)
    const jwt = c.get('jwt')

    const [ user ] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, jwt.id))
      .execute()

    if (!user) {
      throw makeError(ErrorCode.UnknownUser, 404)
    }

    let uploadsAllowedToday = 0

    switch (user.plan) {
      case UserPlan.Free:
        uploadsAllowedToday = 5
        break
    }

    const todayDate = new Date()
    todayDate.setUTCHours(0, 0, 0, 0)
    const tsToday = todayDate.getTime()

    const [ uploadsToday ] = await db
      .select({ count: count(uploadsTable.id) })
      .from(uploadsTable)
      .where(
        and(
          eq(uploadsTable.userId, user.id),
          gte(uploadsTable.createdAt, tsToday)
        )
      )
      .execute()

    if (uploadsToday.count >= uploadsAllowedToday) {
      throw makeError(ErrorCode.UploadLimitExceeded, 403)
    }

    const body = await c.req.parseBody()

    if (!body || !body.file) {
      throw makeError(ErrorCode.BadRequest, 400)
    }

    const file = body.file

    if (typeof file === 'string') {
      throw makeError(ErrorCode.BadRequest, 400)
    }

    const arr = await file.arrayBuffer()

    const mime = fileMime(arr)
    const ext = fileExtension(arr, mime)

    if (!ext) {
      throw makeError(ErrorCode.UnsupportedFileType, 400)
    }

    const name = await sha1(arr)

    const fileName = `${name}.${ext}`
    const key = `uploads/${user.id}/${fileName}`

    const [ upload, result ] = await Promise.allSettled([
      db
        .insert(uploadsTable)
        .values({
          id: snowflake(),
          userId: user.id,
          sha: name,
          mime,
          size: file.size,
          url: slashEnded(c.env.CDN_ENDPOINT) + key,
          createdAt: Date.now(),
        })
        .returning()
        .execute(),
      c.env.R2.put(key, arr)
    ])

    if (result.status === 'rejected') {
      if (upload.status !== 'rejected') {
        c.executionCtx.waitUntil(
          db.delete(uploadsTable).where(eq(uploadsTable.id, upload.status))
        )
      }

      throw makeError(ErrorCode.UploadFailed, 500)
    }

    if (upload.status === 'rejected') {
      if (result.status === 'fulfilled') {
        c.executionCtx.waitUntil(
          c.env.R2.delete(key)
        )
      }

      throw makeError(ErrorCode.UploadFailed, 500)
    }

    return c.json(upload, 201)
  })

export default app
