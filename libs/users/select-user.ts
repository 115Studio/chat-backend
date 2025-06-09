import { DbInstance } from '../db/init'
import { usersTable } from '../db/schema'
import { eq } from 'drizzle-orm'

export const selectUserByOauth = async (db: DbInstance, id: string) => {
  const [ user ] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.oauthId, id))
    .limit(1)
    .execute()

  return user
}

export const selectUser = async (db: DbInstance, id: string) => {
  const [ user ] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1)
    .execute()

  return user
}
