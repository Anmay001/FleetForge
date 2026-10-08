import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { config } from '../config.js';

/**
 * Resolve the SQLite file path. Creates the parent directory if
 * missing. Falls back to ./data/fleetforge.db relative to
 * process.cwd() (which is packages/backend/ in dev).
 */
function resolveDbPath(): string {
  const raw = config.databaseUrl;
  // Special case: in-memory databases have no filesystem path
  if (raw === ':memory:' || raw.startsWith('file::memory:')) {
    return raw;
  }
  const fullPath = path.isAbsolute(raw)
    ? raw
    : path.resolve(process.cwd(), raw);

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return fullPath;
}

// Lazy database connection
let _sqlite: Database.Database | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getSqlite(): Database.Database {
  if (!_sqlite) {
    const dbPath = resolveDbPath();
    _sqlite = new Database(dbPath);

    // Pragmas — set once at connection time
    // Skip WAL for in-memory databases
    if (dbPath !== ':memory:' && !dbPath.startsWith('file::memory:')) {
      _sqlite.pragma('journal_mode = WAL');
    }
    _sqlite.pragma('synchronous = NORMAL');
    _sqlite.pragma('foreign_keys = ON');
    _sqlite.pragma('busy_timeout = 5000');
  }
  return _sqlite;
}

function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    _db = drizzle(getSqlite(), { schema });
  }
  return _db;
}

// Export getters for lazy access
export const getDbClient = getDb;
export const getSqliteClient = getSqlite;

// Drizzle instance with schema for relational queries (lazy)
const dbProxyHandler: ProxyHandler<ReturnType<typeof drizzle>> = {
  get(_target, prop: string | symbol): unknown {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
};
export const db = new Proxy({} as ReturnType<typeof drizzle>, dbProxyHandler);

export type Db = ReturnType<typeof drizzle>;

/**
 * Run pending migrations. Idempotent — safe to call on every boot.
 * In production/test we skip if the migrations folder is missing.
 */
export function runMigrations(): void {
  const migrationsFolder = path.resolve(
    process.cwd(),
    'drizzle'
  );
  if (!fs.existsSync(migrationsFolder)) {
    if (config.isProduction || config.isTest) {
      // eslint-disable-next-line no-console
      console.warn(
        `[db] migrations folder not found at ${migrationsFolder}, skipping migration run`
      );
      return;
    }
    throw new Error(
      `[db] migrations folder not found at ${migrationsFolder}. ` +
        `Run "npm run db:generate" first.`
    );
  }
  migrate(getDb(), { migrationsFolder });
}

/**
 * Graceful close — call on server shutdown.
 */
export function closeDb(): void {
  try {
    if (_sqlite) {
      _sqlite.close();
      _sqlite = null;
      _db = null;
    }
  } catch {
    // already closed
  }
}

/**
 * Utility for health checks: returns true if the DB responds to
 * a trivial query.
 */
export function isDbHealthy(): boolean {
  try {
    const result = getSqlite().prepare('SELECT 1 AS ok').get() as
      | { ok: number }
      | undefined;
    return result?.ok === 1;
  } catch {
    return false;
  }
}

// Re-export the raw handle for the rare case we need raw SQL
export { getSqlite as sqlite };