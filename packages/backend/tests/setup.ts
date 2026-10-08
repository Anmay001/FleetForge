import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Use in-memory SQLite for tests. This must be set BEFORE any
  // module imports the db client.
  process.env.DATABASE_URL = ':memory:';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
});

afterAll(() => {
  // Nothing to tear down — memory DB is discarded when process exits
});