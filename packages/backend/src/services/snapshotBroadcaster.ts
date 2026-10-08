import { robotsRepo } from '../repositories/index.js';
import { broadcastFleet } from './broadcaster.js';
import { wsHub } from '../websocket/hub.js';
import { config } from '../config.js';

let timer: NodeJS.Timeout | null = null;

/**
 * Start the periodic fleet broadcaster. Called once at server boot.
 * Returns a cleanup function.
 */
export function startSnapshotBroadcaster(
  onLog?: (info: { clients: number; robots: number }) => void
): () => void {
  if (timer) {
    clearInterval(timer);
  }

  timer = setInterval(() => {
    // Skip work when nobody is listening
    const clientCount = wsHub.getClientCount();
    if (clientCount === 0) return;

    try {
      const rows = robotsRepo.findAllRobots();
      const delivered = broadcastFleet(rows);
      onLog?.({ clients: delivered, robots: rows.length });
    } catch (err) {
      // Swallow — a broken broadcast shouldn't kill the timer
      // eslint-disable-next-line no-console
      console.warn('[snapshotBroadcaster] broadcast failed:', err);
    }
  }, config.snapshotIntervalMs);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    };
  };
}

/**
 * Broadcast once immediately (used after a manual state change for
 * faster perceived latency).
 */
export function broadcastFleetNow(): void {
  const rows = robotsRepo.findAllRobots();
  broadcastFleet(rows);
}