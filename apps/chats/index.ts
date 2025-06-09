import { Hono } from 'hono'
import { HonoEnvironment } from '../../environment'

const app = new Hono<HonoEnvironment>()

export default app
