import { DbInstance } from '../db/init'
import { usersTable } from '../db/schema'
import { snowflake } from '../utils/snowflake'
import { OauthProvider } from '../constants/oauth-provider'

export interface OauthData {
  id: string
  provider: OauthProvider
}

export const registerUser = async (
  db: DbInstance, name: string, email?: string, oauth?: OauthData
) => {
  const [ user ] = await db
    .insert(usersTable)
    .values({
      id: snowflake(),
      name,
      email,
      oauthId: oauth?.id,
      oauthProvider: oauth?.provider,
    })
    .onConflictDoNothing()
    .returning()
    .execute()

  return user
}
