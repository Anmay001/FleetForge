import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL ?? './data/fleetforge.db';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: dbUrl,
  },
  verbose: true,
  strict: true,
});