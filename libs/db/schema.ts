import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  oauthId: text('oauth_id'),
}, (t) => [
  uniqueIndex('users_id_index').on(t.id),
  uniqueIndex('users_oauth_id_index').on(t.oauthId),
])
