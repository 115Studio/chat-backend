import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './libs/db/schema.ts',
  out: './libs/db/migrations/sqlite',
})
