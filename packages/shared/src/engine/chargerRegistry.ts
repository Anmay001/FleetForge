import { CHARGING_PADS } from '../data/warehouseLayout';

/**
 * Radius (meters) within which a robot is considered "at" a 
 * charger. Chargers sit on waypoints at grid intersections, so 
 * this is roughly the arrival tolerance plus a small buffer.
 */
export const CHARGER_ARRIVAL_RADIUS = 0.6;

export interface ChargerState {
  /** Charger waypoint ID (e.g. CHARGE-01) */
  id: string;
  /** World position (from CHARGING_PADS) */
  x: number;
  z: number;
  /** Robot ID currently occupying or reserving this charger, or 
   *  null if free */
  occupiedBy: string | null;
  /** Timestamp when the current occupancy started */
  occupiedSince: number;
  /** True if the occupying robot is actively charging (arrived), 
   *  false if it's still en route */
  charging: boolean;
}

const OCCUPANCY_TTL_MS = 60_000;

class ChargerRegistry {
  private chargers: Map<string, ChargerState> = new Map();

  constructor() {
    for (const pad of CHARGING_PADS) {
      this.chargers.set(pad.id, {
        id: pad.id,
        x: pad.x,
        z: pad.z,
        occupiedBy: null,
        occupiedSince: 0,
        charging: false,
      });
    }
  }

  /**
   * Attempt to reserve a charger for a robot. Returns true if the 
   * reservation succeeded (charger was free, expired, or already 
   * held by this robot).
   */
  reserve(chargerId: string, robotId: string): boolean {
    const c = this.chargers.get(chargerId);
    if (!c) return false;

    // Expire stale occupancy
    if (
      c.occupiedBy !== null &&
      Date.now() - c.occupiedSince > OCCUPANCY_TTL_MS
    ) {
      c.occupiedBy = null;
      c.occupiedSince = 0;
      c.charging = false;
    }

    if (c.occupiedBy === null) {
      c.occupiedBy = robotId;
      c.occupiedSince = Date.now();
      c.charging = false;
      return true;
    }
    return c.occupiedBy === robotId;
  }

  /** Mark a robot as actively charging (it has arrived). */
  markCharging(chargerId: string, robotId: string): void {
    const c = this.chargers.get(chargerId);
    if (c && c.occupiedBy === robotId) {
      c.charging = true;
    }
  }

  /** Release a charger — call when the robot leaves or finishes. */
  release(chargerId: string, robotId: string): void {
    const c = this.chargers.get(chargerId);
    if (c && c.occupiedBy === robotId) {
      c.occupiedBy = null;
      c.occupiedSince = 0;
      c.charging = false;
    }
  }

  /**
   * Return the ID of the charger closest to (x, z) that is either 
   * free or reserved by this robot. Returns null if all chargers 
   * are held by other robots.
   */
  findFreeCharger(
    x: number,
    z: number,
    robotId: string
  ): string | null {
    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const c of this.chargers.values()) {
      const isMine = c.occupiedBy === robotId;
      const isFree = c.occupiedBy === null;
      if (!isMine && !isFree) continue;

      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestDist) {
        bestDist = d;
        bestId = c.id;
      }
    }
    return bestId;
  }

  /**
   * Returns the number of robots currently queued for a specific 
   * charger. A robot is "queued" if it's targeting the charger 
   * but hasn't arrived yet.
   */
  queueDepth(chargerId: string): number {
    const c = this.chargers.get(chargerId);
    if (!c) return 0;
    return c.occupiedBy !== null && !c.charging ? 1 : 0;
  }

  /** Snapshot for diagnostics / tests. */
  snapshot(): ChargerState[] {
    return Array.from(this.chargers.values()).map((c) => ({ ...c }));
  }

  /** Release all chargers held by a specific robot. */
  releaseAllForRobot(robotId: string): void {
    for (const c of this.chargers.values()) {
      if (c.occupiedBy === robotId) {
        c.occupiedBy = null;
        c.occupiedSince = 0;
        c.charging = false;
      }
    }
  }

  /** Wipe all reservations (called on simulation reset). */
  clear(): void {
    for (const c of this.chargers.values()) {
      c.occupiedBy = null;
      c.occupiedSince = 0;
      c.charging = false;
    }
  }
}

export const chargerRegistry = new ChargerRegistry();
