import { Hono } from 'hono'
import discord from './discord'

const app = new Hono()

app.route('/discord', discord)

export default app
