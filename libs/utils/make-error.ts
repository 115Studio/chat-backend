import { ErrorCode, errorMessages } from '../constants/errors'
import { HTTPException } from 'hono/http-exception'
import {
  ContentfulStatusCode,
  StatusCode,
  // @ts-ignore
} from 'hono/http-exception/dist/types'

export const makeError = (code: ErrorCode, http: StatusCode) => {
  return new HTTPException(http as ContentfulStatusCode, {
    message: `[${code}] ${errorMessages[code]}`,
  })
}

export const makeTextError = (code: ErrorCode) => {
  return `[${code}]: ${errorMessages[code]}`
}
