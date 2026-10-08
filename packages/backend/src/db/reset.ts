import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Reset the database.
 * 1. Close any open connection (implicit — new process)
 * 2. Delete the SQLite file and WAL files
 * 3. Re-run migrations
 * 4. Optionally seed
 */
async function reset(): Promise<void> {
  const raw = config.databaseUrl;
  const fullPath = path.isAbsolute(raw)
    ? raw
    : path.resolve(process.cwd(), raw);

  console.log(`[reset] database path: ${fullPath}`);

  const filesToDelete = [
    fullPath,
    `${fullPath}-wal`,
    `${fullPath}-shm`,
  ];

  for (const file of filesToDelete) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`[reset] deleted ${file}`);
    }
  }

  // Fresh module imports after deletion
  const { runMigrations } = await import('./client.js');
  runMigrations();
  console.log('[reset] migrations reapplied');

  // Optional: seed with initial data
  const shouldSeed = process.argv.includes('--seed');
  if (shouldSeed) {
    const { seed } = await import('./seed.js');
    await seed();
    console.log('[reset] seed applied');
  }

  console.log('[reset] done');
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[reset] failed:', err);
    process.exit(1);
  });