import 'dotenv/config';
import { initialFleet } from '@fleetforge/shared';
import { db, runMigrations } from './index.js';
import { robots, tasks } from './schema.js';
import { robotsRepo } from '../repositories/index.js';

/**
 * Seed the database with the initial fleet.
 * Idempotent: upserts robots, leaves tasks untouched if they exist.
 */
async function seed(): Promise<void> {
  console.log('[seed] starting');

  // Ensure schema is current
  runMigrations();

  // Upsert initial robots
  console.log('[seed] upserting robots...');
  const inserts = initialFleet.map(robotsRepo.amrToInsert);
  robotsRepo.bulkUpsertRobots(inserts);
  console.log(`[seed] upserted ${inserts.length} robots`);

  // Check if tasks already exist
  const existingTasks = db.select().from(tasks).all();
  if (existingTasks.length > 0) {
    console.log(
      `[seed] ${existingTasks.length} tasks already exist, skipping`
    );
  } else {
    console.log('[seed] no tasks present — will be created by the ' +
      'auto-generator on first boot');
  }

  // Verify
  const robotCount = db.select().from(robots).all().length;
  console.log(`[seed] done — ${robotCount} robots in DB`);
}

// Only run when called directly
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('seed.ts') ||
    process.argv[1]?.endsWith('seed.js')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}

export { seed };