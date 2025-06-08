import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { OauthProvider } from '../constants/oauth-provider'

export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  oauthId: text('oauth_id'),
  oauthProvider: text('oauth_provider').$type<OauthProvider | undefined>()
}, (t) => [
  uniqueIndex('users_id_index').on(t.id),
  uniqueIndex('users_oauth_id_index').on(t.oauthId),
])
