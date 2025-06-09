import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { OauthProvider } from '../constants/oauth-provider'
import { UserPlan } from '../constants/user-plan'
import { IntBoolean } from '../constants/int-boolean'
import { AiModel } from '../constants/ai-model'
import { MessageRole } from '../constants/message-role'
import { MessageState } from '../constants/message-state'

export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),

  email: text('email'),
  name: text('name').notNull(),

  plan: integer('plan').$type<UserPlan>().default(UserPlan.Free).notNull(),

  oauthId: text('oauth_id'),
  oauthProvider: text('oauth_provider').$type<OauthProvider | undefined>()
}, (t) => [
  uniqueIndex('users_id_index').on(t.id),
  uniqueIndex('users_oauth_id_index').on(t.oauthId),
])

export type User = typeof usersTable.$inferSelect

export const channelsTable = sqliteTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull(),

  // Normally, I would use a numeric bitmask for flags, but I don't have time to implement it now.
  isPinned: integer('is_pinned').default(IntBoolean.False).notNull(),
  isBranch: integer('is_branch').default(IntBoolean.False).notNull(),
  isTemporary: integer('is_temporary').default(IntBoolean.False).notNull(),
  isPublic: integer('is_public').default(IntBoolean.False).notNull(),

  createdAt: integer('created_at').notNull(),
}, (t) => [
  uniqueIndex('channels_id_index').on(t.id),
  index('channels_owner_id_index').on(t.ownerId),
  index('channels_is_pinned_index').on(t.isPinned),
  index('channels_created_at_index').on(t.createdAt),
])

export type Channel = typeof channelsTable.$inferSelect

export const messagesTable = sqliteTable('messages', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(), // For grouping messages in one slider
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),

  state: integer('state').$type<MessageState>().notNull(),
  role: text('role').$type<MessageRole>().notNull(),
  model: text('model').$type<AiModel>().notNull(),

  content: text('content'),
  files: text('files'),

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
}, (t) => [
  uniqueIndex('messages_id_index').on(t.id),
  index('messages_channel_id_index').on(t.channelId),
  index('messages_user_id_index').on(t.userId),
  index('messages_created_at_index').on(t.createdAt),
])

export type Message = typeof messagesTable.$inferSelect
