import { segmentKey } from './pheromoneMap';

const LOCK_TTL_MS = 8000;        // lock expires if not refreshed
const PUBLICATION_TTL_MS = 15000; // stale publications get dropped

export interface RoutePublication {
  robotId: string;
  path: string[];             // remaining waypoints; path[0] = current
  nextWaypointId: string | null;
  publishedAt: number;
}

interface WaypointLock {
  robotId: string;
  expiresAt: number;
}

class RouteRegistry {
  private publications = new Map<string, RoutePublication>();
  private locks = new Map<string, WaypointLock>();

  /** Publish or update a robot's route. */
  publish(
    robotId: string,
    path: string[],
    nextWaypointId: string | null
  ): void {
    this.publications.set(robotId, {
      robotId,
      path,
      nextWaypointId,
      publishedAt: Date.now(),
    });
  }

  /** Remove a robot's publication. */
  unpublish(robotId: string): void {
    this.publications.delete(robotId);
  }

  get(robotId: string): RoutePublication | undefined {
    return this.publications.get(robotId);
  }

  /**
   * Try to acquire a lock on a waypoint. Returns true if we got it
   * (either it was free, expired, or already ours).
   */
  lockWaypoint(waypointId: string, robotId: string): boolean {
    const existing = this.locks.get(waypointId);
    const now = Date.now();

    if (!existing || existing.expiresAt < now) {
      this.locks.set(waypointId, {
        robotId,
        expiresAt: now + LOCK_TTL_MS,
      });
      return true;
    }
    return existing.robotId === robotId;
  }

  /** Refresh the TTL on a lock we already hold. */
  refreshLock(waypointId: string, robotId: string): void {
    const existing = this.locks.get(waypointId);
    if (existing && existing.robotId === robotId) {
      existing.expiresAt = Date.now() + LOCK_TTL_MS;
    }
  }

  /** Release a lock only if we own it. */
  releaseWaypoint(waypointId: string, robotId: string): void {
    const existing = this.locks.get(waypointId);
    if (existing && existing.robotId === robotId) {
      this.locks.delete(waypointId);
    }
  }

  /** Who owns this waypoint right now (respecting expiry)? */
  owner(waypointId: string): string | null {
    const existing = this.locks.get(waypointId);
    if (!existing) return null;
    if (existing.expiresAt < Date.now()) {
      this.locks.delete(waypointId);
      return null;
    }
    return existing.robotId;
  }

  /**
   * Waypoints currently locked, keyed by waypointId -> robotId.
   * Excludes the given robot (so it doesn't penalize itself).
   */
  occupiedWaypoints(excludeRobotId?: string): Map<string, string> {
    const result = new Map<string, string>();
    const now = Date.now();
    for (const [wpId, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) continue;
      if (excludeRobotId && lock.robotId === excludeRobotId) continue;
      result.set(wpId, lock.robotId);
    }
    return result;
  }

  /**
   * Segments currently claimed by OTHER robots' publications.
   * Builds from each publication's remaining path (consecutive pairs).
   */
  reservedSegments(excludeRobotId?: string): Set<string> {
    const result = new Set<string>();
    for (const pub of this.publications.values()) {
      if (excludeRobotId && pub.robotId === excludeRobotId) continue;
      for (let i = 0; i < pub.path.length - 1; i++) {
        result.add(segmentKey(pub.path[i], pub.path[i + 1]));
      }
    }
    return result;
  }

  /** Housekeeping: expire stale publications. Call ~1 Hz. */
  tick(): void {
    const now = Date.now();
    for (const [robotId, pub] of this.publications.entries()) {
      if (now - pub.publishedAt > PUBLICATION_TTL_MS) {
        this.publications.delete(robotId);
      }
    }
    for (const [wpId, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(wpId);
      }
    }
  }

  /** Number of active locks (for diagnostics). */
  lockCount(): number {
    return this.locks.size;
  }

  /** Wipe everything (used on simulation reset). */
  clear(): void {
    this.publications.clear();
    this.locks.clear();
  }
}

export const routeRegistry = new RouteRegistry();
