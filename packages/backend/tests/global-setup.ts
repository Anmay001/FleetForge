// Global setup runs once before all tests
// Sets environment variables for in-memory database
process.env.DATABASE_URL = ':memory:';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

export default function globalSetup() {
  // Runs once before all tests
}