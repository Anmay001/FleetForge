import { eventsRepo } from '../repositories/index.js';
import { getSqliteClient } from '../db/index.js';
import { config } from '../config.js';

const PRUNE_INTERVAL_MS = 60_000;   // 1 minute
const CHECKPOINT_INTERVAL_MS = 120_000; // 2 minutes

let pruneTimer: NodeJS.Timeout | null = null;
let checkpointTimer: NodeJS.Timeout | null = null;

/**
 * Run a single prune cycle. Keeps the most recent N events where N
 * is EVENT_LOG_LIMIT from config. Returns how many were pruned.
 */
export function pruneOnce(): number {
  const before = eventsRepo.countEvents();
  const keepLast = config.eventLogLimit;
  if (before <= keepLast) return 0;
  const pruned = eventsRepo.pruneEvents(keepLast);
  return pruned;
}

/**
 * Run a WAL checkpoint so the -wal file gets folded back into the
 * main DB. Prevents unbounded growth during long-running sessions.
 */
export function checkpointOnce(): void {
  try {
    getSqliteClient().pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[eventPruner] wal_checkpoint failed:', err);
  }
}

/**
 * Start the background maintenance loop. Returns a cleanup function.
 */
export function startMaintenance(
  onLog?: (info: { pruned: number; checkpointed: boolean }) => void
): () => void {
  // Prune timer
  pruneTimer = setInterval(() => {
    try {
      const pruned = pruneOnce();
      if (pruned > 0) {
        onLog?.({ pruned, checkpointed: false });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[eventPruner] prune failed:', err);
    }
  }, PRUNE_INTERVAL_MS);

  // Checkpoint timer
  checkpointTimer = setInterval(() => {
    checkpointOnce();
  }, CHECKPOINT_INTERVAL_MS);

  return () => {
    if (pruneTimer) {
      clearInterval(pruneTimer);
      pruneTimer = null;
    }
    if (checkpointTimer) {
      clearInterval(checkpointTimer);
      checkpointTimer = null;
    }
  };
}