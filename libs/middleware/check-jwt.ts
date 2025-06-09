import { createMiddleware } from 'hono/factory'
import { Context, Next } from 'hono'
import { makeError } from '../utils/make-error'
import { ErrorCode } from '../constants/errors'
import { JwtPayload, verifyJwt } from '../crypto/jwt'
import { AddVariable } from '../utils/add-variable'

export type JwtVariable = AddVariable<'jwt', JwtPayload>

export const checkJwt = createMiddleware(async (c: Context, next: Next) => {
  const jwt = c.req.header('Authorization')

  if (!jwt) {
    throw makeError(ErrorCode.Unauthorized, 401)
  }

  const valid = await verifyJwt(c.env.JWT_SECRET, jwt)

  if (!valid) {
    throw makeError(ErrorCode.AuthorizationFailed, 403)
  }

  return next()
})
