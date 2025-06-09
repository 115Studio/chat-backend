import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'
import z from 'zod/v4'
import { zValidator } from '@hono/zod-validator'
import { makeError } from '../../libs/utils/make-error'
import { ErrorCode } from '../../libs/constants/errors'
import { getDiscordUser } from '../../libs/oauth/discord/get-discord-user'
import { registerUser } from '../../libs/users/register-user'
import { initDbConnect } from '../../libs/db/init'
import { OauthProvider } from '../../libs/constants/oauth-provider'
import { signJwt } from '../../libs/crypto/jwt'
import { selectUserByOauth } from '../../libs/users/select-user'

const app = new Hono<HonoEnvironment>()

const discordAuthorizeDto = z.object({
  code: z.string(),
  redirectUri: z.url(),
})

interface DiscordTokens {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

app.post('/authorize', zValidator('json', discordAuthorizeDto), async (c) => {
  const { code, redirectUri } = c.req.valid('json')

  const e = c.env, db = initDbConnect(e)

  const body = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID,
    client_secret: e.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope: 'identify email',
  })

  const response = await fetch('https://discord.com/api/oauth2/token', {
    body,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).catch(console.error)

  if (!response?.ok) {
    throw makeError(ErrorCode.ThirdPartyFailure, 500)
  }

  const tokens = await response.json() as DiscordTokens

  if (!tokens.access_token) {
    throw makeError(ErrorCode.ThirdPartyFailure, 500)
  }

  const discordUser = await getDiscordUser(tokens.access_token)

  let user = await selectUserByOauth(db, discordUser.id)

  if (!user) {
    user = await registerUser(
      db,
      discordUser.display_name ?? discordUser.username,
      discordUser.email,
      {
        id: discordUser.id,
        provider: OauthProvider.Discord
      }
    )
  }

  return c.json({
    success: true,
    id: user.id,
    email: user.email,
    name: user.name,
    jwt: await signJwt(e.JWT_SECRET, user.id, user.plan)
  })
})

export default app
