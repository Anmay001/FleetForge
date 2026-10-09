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
  private segmentLocks = new Map<string, {
    robotId: string;
    expiresAt: number;
  }>();

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
        const a = pub.path[i];
        const b = pub.path[i + 1];
        if (a && b) result.add(segmentKey(a, b));
      }
    }
    return result;
  }

  /**
   * Try to acquire an exclusive lock on a lane segment. Returns 
   * true if we got it (free, expired, or already ours).
   */
  lockSegment(
    fromWaypointId: string,
    toWaypointId: string,
    robotId: string
  ): boolean {
    const key = segmentKey(fromWaypointId, toWaypointId);
    const existing = this.segmentLocks.get(key);
    const now = Date.now();

    if (!existing || existing.expiresAt < now) {
      this.segmentLocks.set(key, {
        robotId,
        expiresAt: now + LOCK_TTL_MS,
      });
      return true;
    }
    return existing.robotId === robotId;
  }

  refreshSegmentLock(
    fromWaypointId: string,
    toWaypointId: string,
    robotId: string
  ): void {
    const key = segmentKey(fromWaypointId, toWaypointId);
    const existing = this.segmentLocks.get(key);
    if (existing && existing.robotId === robotId) {
      existing.expiresAt = Date.now() + LOCK_TTL_MS;
    }
  }

  releaseSegment(
    fromWaypointId: string,
    toWaypointId: string,
    robotId: string
  ): void {
    const key = segmentKey(fromWaypointId, toWaypointId);
    const existing = this.segmentLocks.get(key);
    if (existing && existing.robotId === robotId) {
      this.segmentLocks.delete(key);
    }
  }

  /**
   * Returns the robot ID currently holding the segment lock, or 
   * null if free/expired.
   */
  segmentOwner(
    fromWaypointId: string,
    toWaypointId: string
  ): string | null {
    const key = segmentKey(fromWaypointId, toWaypointId);
    const existing = this.segmentLocks.get(key);
    if (!existing) return null;
    if (existing.expiresAt < Date.now()) {
      this.segmentLocks.delete(key);
      return null;
    }
    return existing.robotId;
  }

  /**
   * Release all waypoint and segment reservations for a robot.
   */
  clearRobotReservations(robotId: string): void {
    for (const [wpId, lock] of this.locks.entries()) {
      if (lock.robotId === robotId) {
        this.locks.delete(wpId);
      }
    }
    for (const [key, lock] of this.segmentLocks.entries()) {
      if (lock.robotId === robotId) {
        this.segmentLocks.delete(key);
      }
    }
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
    for (const [key, lock] of this.segmentLocks.entries()) {
      if (lock.expiresAt < now) {
        this.segmentLocks.delete(key);
      }
    }
  }

  /** Number of active locks (for diagnostics). */
  lockCount(): number {
    return this.locks.size;
  }

  segmentLockCount(): number {
    return this.segmentLocks.size;
  }

  /** Wipe everything (used on simulation reset). */
  clear(): void {
    this.publications.clear();
    this.locks.clear();
    this.segmentLocks.clear();
  }
}

export const routeRegistry = new RouteRegistry();
