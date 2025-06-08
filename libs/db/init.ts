import { drizzle } from 'drizzle-orm/d1'
import { EventEnvironment } from '../../environment'
import * as schema from './schema'

export const initDbConnect = (env: EventEnvironment) =>
  drizzle(env.DB, { schema, casing: 'snake_case' })

export type DbInstance = ReturnType<typeof initDbConnect>
