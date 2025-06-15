import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import z from 'zod/v4'
import { zValidator } from '@hono/zod-validator'
import { checkJwt, JwtVariable } from '../../libs/middleware/check-jwt'
import { deconstructSnowflake } from '../../libs/utils/snowflake'
import { getDo } from '../../libs/utils/get-do'
import { initDbConnect } from '../../libs/db/init'
import { channelsTable, messagesTable } from '../../libs/db/schema'
import { and, desc, eq, gt, lt } from 'drizzle-orm'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { zResponse } from '../../libs/utils/z-response'

import messages from './messages'

const app = new Hono<HonoEnvironment & JwtVariable>()

app.use(checkJwt)

app.route('', messages)

const updateChannelDto = z.object({
  name: z.string().min(1).max(100),
})

const getChannelsDto = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(10),
  pins: z.coerce.boolean().default(false),
})

const pinChannelDto = z.object({
  pin: z.coerce.boolean().default(false),
})

app.get('/', zValidator('query', getChannelsDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { from, to, limit, pins } = c.req.valid('query')

  const conditions = [eq(channelsTable.ownerId, jwt.id)]

  if (from) {
    const fromChannelCreatedAt = deconstructSnowflake(from).timestamp

    if (fromChannelCreatedAt) {
      conditions.push(gt(channelsTable.createdAt, fromChannelCreatedAt))
    }
  }

  if (to) {
    const toChannelCreatedAt = deconstructSnowflake(to).timestamp

    if (toChannelCreatedAt) {
      conditions.push(lt(channelsTable.createdAt, toChannelCreatedAt))
    }
  }

  const [channels, pinned] = await Promise.all([
    db
      .select()
      .from(channelsTable)
      .where(and(...conditions))
      .orderBy(desc(channelsTable.createdAt))
      .limit(limit)
      .execute(),
    pins
      ? db
          .select()
          .from(channelsTable)
          .where(and(eq(channelsTable.ownerId, jwt.id), eq(channelsTable.isPinned, true)))
          .orderBy(desc(channelsTable.createdAt))
      : undefined,
  ])

  const result = pins ? [...new Map([...pinned!, ...channels].map((c) => [c.id, c])).values()] : channels

  return c.json({
    channels: result,
  })
})

app.patch('/:id', zValidator('json', updateChannelDto, zResponse), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const channelId = c.req.param('id')
  const { name } = c.req.valid('json')

  const channels = await db
    .select()
    .from(channelsTable)
    .where(and(eq(channelsTable.id, channelId), eq(channelsTable.ownerId, jwt.id)))
    .execute()

  const channel = channels[0]
  if (!channel) {
    throw makeError(ErrorCode.UnknownChannel, 404)
  }

  if (channel.name === name.trim())
    return c.json({
      channel,
    })

  const [newChannel] = await db
    .update(channelsTable)
    .set({ name: name.trim() })
    .where(eq(channelsTable.id, channel.id))
    .returning()
    .execute()

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackChannelUpdate(jwt.id, newChannel))

  return c.json({
    channel: newChannel,
  })
})

app.post('/:id/pin', zValidator('json', pinChannelDto), async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const { pin } = c.req.valid('json')

  const channelId = c.req.param('id')

  const channels = await db
    .select()
    .from(channelsTable)
    .where(and(eq(channelsTable.id, channelId), eq(channelsTable.ownerId, jwt.id)))
    .execute()

  const channel = channels[0]
  if (!channel) {
    throw makeError(ErrorCode.UnknownChannel, 404)
  }

  const [newChannel] = await db
    .update(channelsTable)
    .set({ isPinned: pin })
    .where(eq(channelsTable.id, channel.id))
    .returning()
    .execute()

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackChannelUpdate(jwt.id, newChannel))

  return c.json({
    channel: newChannel,
  })
})

app.delete('/:id', async (c) => {
  const db = initDbConnect(c.env)
  const jwt = c.get('jwt')

  const channelId = c.req.param('id')

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(and(eq(channelsTable.id, channelId), eq(channelsTable.ownerId, jwt.id)))
    .execute()

  if (!channel) throw makeError(ErrorCode.UnknownChannel, 404)

  await Promise.all([
    db.delete(channelsTable).where(eq(channelsTable.id, channel.id)).execute(),
    db.delete(messagesTable).where(eq(messagesTable.channelId, channel.id)).execute(),
  ])

  const { doStub } = getDo(c.env, jwt.id)

  c.executionCtx.waitUntil(doStub.ackChannelDelete(jwt.id, channelId))

  return c.json({
    success: true,
  })
})

export default app
