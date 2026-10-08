import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173'),
  DATABASE_URL: z.string().default('./data/fleetforge.db'),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  EVENT_LOG_LIMIT: z.coerce.number().int().positive().default(500),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '[config] Invalid environment variables:',
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  host: env.HOST,
  logLevel: env.LOG_LEVEL,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: env.DATABASE_URL,
  snapshotIntervalMs: env.SNAPSHOT_INTERVAL_MS,
  eventLogLimit: env.EVENT_LOG_LIMIT,
});

export type Config = typeof config;