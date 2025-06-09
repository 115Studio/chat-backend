import { makeError } from '../../utils/make-error'
import { ErrorCode } from '../../constants/errors'

export interface DiscordUser {
  id: string
  display_name?: string
  username: string
  avatar?: string
  email?: string
}

export const getDiscordUser = async (
  accessToken: string,
): Promise<DiscordUser> => {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw makeError(ErrorCode.ThirdPartyFailure, 500)
  }

  const user = await response.json() as Partial<DiscordUser>

  if (!user.id || !user.username) {
    throw makeError(ErrorCode.ThirdPartyFailure, 400)
  }

  return user as DiscordUser
}
