import { Context } from 'hono'
import z from 'zod/v4'
import { ErrorCode } from '../constants/errors'

export const zResponse = (result: any, c: Context) => {
  if (!result.success) {
    return c.text(`[${ErrorCode.BadRequest}]: ` + z.prettifyError(result.error), 400)
  }
}
