import { UserPlan } from '../constants/user-plan'
import { decode, sign, verify } from 'hono/jwt'
import { EventEnvironment } from '../../environment'

export interface JwtPayload {
  id: string
  plan: UserPlan
}

export const signJwt = async (
  secret: string, id: string, plan: UserPlan
) => {
  return sign({ id, plan }, secret, 'HS256')
}

export const verifyJwt = async (secret: string, token: string) => {
  try {
    return await verify(token, secret, 'HS256') as unknown as JwtPayload
  } catch (err) {
    console.error('JWT verification failed:', err)
    return null
  }
}
