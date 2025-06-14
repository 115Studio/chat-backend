import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { OauthProvider } from '../constants/oauth-provider'
import { UserPlan } from '../constants/user-plan'
import { AiModel } from '../constants/ai-model'
import { MessageRole } from '../constants/message-role'
import { MessageState } from '../constants/message-state'
import { MessageStageType } from '../constants/message-stage-type'
import { MessageStageContentType } from '../constants/message-stage-content-type'
import { AiModelFlag } from '../constants/ai-model-flag'

const displayModelsDefault: AiModel[] = []

export const usersTable = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),

    email: text('email'),
    name: text('name').notNull(),

    plan: integer('plan').$type<UserPlan>().default(UserPlan.Free).notNull(),

    defaultModel: text('default_model').$type<AiModel>().default(AiModel.OpenaiGpt35Turbo).notNull(),
    displayModels: text('display_models', { mode: 'json' }).$type<AiModel[]>().default(displayModelsDefault).notNull(),

    oauthId: text('oauth_id'),
    oauthProvider: text('oauth_provider').$type<OauthProvider | undefined>(),
  },
  (t) => [uniqueIndex('users_id_index').on(t.id), uniqueIndex('users_oauth_id_index').on(t.oauthId)],
)

export type User = typeof usersTable.$inferSelect

export const channelsTable = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerId: text('owner_id').notNull(),

    // Normally, I would use a numeric bitmask for flags, but I don't have time to implement it now.
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false).notNull(),
    isBranch: integer('is_branch', { mode: 'boolean' }).default(false).notNull(),
    isTemporary: integer('is_temporary', { mode: 'boolean' }).default(false).notNull(),
    isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at'),
  },
  (t) => [
    uniqueIndex('channels_id_index').on(t.id),
    index('channels_owner_id_index').on(t.ownerId),
    index('channels_is_pinned_index').on(t.isPinned),
    index('channels_created_at_index').on(t.createdAt),
    index('channels_updated_at_index').on(t.updatedAt),
  ],
)

export type Channel = typeof channelsTable.$inferSelect

export interface MessageStageContent {
  type: MessageStageContentType
  value?: string
}

export interface MessageStage {
  id?: string
  type: MessageStageType
  content?: MessageStageContent
}

export type MessageStages = MessageStage[]

export interface ModelSettings {
  id: AiModel
  key?: string
  flags?: AiModelFlag[]
}

export const messagesTable = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(), // For grouping messages in one slider
    channelId: text('channel_id').notNull(),
    userId: text('user_id').notNull(),

    state: integer('state').$type<MessageState>().notNull(),
    role: text('role').$type<MessageRole>().notNull(),

    model: text('model', { mode: 'json' }).$type<ModelSettings>().notNull(),
    stages: text('stages', { mode: 'json' }).$type<MessageStages>().default([]).notNull(),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at'),
  },
  (t) => [
    uniqueIndex('messages_id_index').on(t.id),
    index('messages_state_index').on(t.state),
    index('messages_channel_id_index').on(t.channelId),
    index('messages_user_id_index').on(t.userId),
    index('messages_created_at_index').on(t.createdAt),
  ],
)

export type Message = typeof messagesTable.$inferSelect

export const uploadsTable = sqliteTable(
  'uploads',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    sha: text('sha').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    url: text('url').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('uploads_id_index').on(t.id),
    index('uploads_user_id_index').on(t.userId),
    index('uploads_sha_index').on(t.sha),
    index('uploads_created_at_index').on(t.createdAt),
  ],
)

export type Upload = typeof uploadsTable.$inferSelect

export const BYOKTable = sqliteTable(
  'byok',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    name: text('name').notNull(),
    key: text('key').notNull(),
    models: text('models', { mode: 'json' }).$type<AiModel[]>().notNull(),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at'),
  },
  (t) => [uniqueIndex('byok_id_index').on(t.id), index('byok_user_id_index').on(t.userId)],
)

export type BYOK = typeof BYOKTable.$inferSelect

export const personalityTable = sqliteTable(
  'personality',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    name: text('name').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),

    prompt: text('prompt').notNull(),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at'),
  },
  (t) => [
    uniqueIndex('personality_id_index').on(t.id),
    index('personality_user_id_index').on(t.userId),
    index('personality_is_default_index').on(t.isDefault),
  ],
)

export type Personality = typeof personalityTable.$inferSelect

export const syncedMessagesTable = sqliteTable(
  'synced_messages',
  {
    userId: text('user_id').notNull(),
    channelId: text('channel_id').notNull(),

    stages: text('stages', { mode: 'json' }).$type<MessageStages>().default([]).notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.channelId],
    }),
    index('synced_messages_user_id_index').on(t.userId),
    index('synced_messages_channel_id_index').on(t.channelId),
  ],
)

export type SyncedDBMessage = typeof syncedMessagesTable.$inferSelect
