/**
 * Rolling memory of which waypoints have recently produced 
 * successful deliveries. Consumed by the destination selector as 
 * an imitation signal — a modern take on Maynard-Cross Learning 
 * from the Soma et al. hive-mind paper.
 *
 * Success is recorded when an AMR transitions DROPPING → IDLE 
 * (i.e., delivers a payload at a drop zone). Each success 
 * increments the waypoint's score by 1.0. Scores decay 5% per 
 * coordinator tick (5 Hz) so old wins fade and the fleet stays 
 * adaptive.
 *
 * The map is in-memory only — no persistence, no DB writes. It 
 * resets when the simulation resets.
 */
class PeerMemory {
  private successByWaypoint: Map<string, number> = new Map();
  private lastDecayAt = 0;

  /**
   * Record that a delivery just succeeded at a waypoint. The 
   * waypoint ID is the destination the AMR just delivered to.
   */
  recordSuccess(waypointId: string): void {
    const current = this.successByWaypoint.get(waypointId) ?? 0;
    this.successByWaypoint.set(
      waypointId,
      Math.min(5.0, current + 1.0)
    );
  }

  /**
   * Read the current imitation weight for a waypoint. Returns 0 if 
   * the waypoint has no recent successes.
   */
  weight(waypointId: string): number {
    return this.successByWaypoint.get(waypointId) ?? 0;
  }

  /**
   * Decay every waypoint's score. Call on a fixed interval. 
   * Idempotent within the same timestamp.
   */
  decay(nowMs: number): void {
    if (this.lastDecayAt === 0) {
      this.lastDecayAt = nowMs;
      return;
    }
    const dtSec = (nowMs - this.lastDecayAt) / 1000;
    this.lastDecayAt = nowMs;
    if (dtSec <= 0) return;
    const factor = Math.max(0, 1 - 0.05 * dtSec);
    for (const [id, value] of this.successByWaypoint.entries()) {
      const next = value * factor;
      if (next < 0.05) {
        this.successByWaypoint.delete(id);
      } else {
        this.successByWaypoint.set(id, next);
      }
    }
  }

  /** Total weight across all waypoints — diagnostic. */
  total(): number {
    let sum = 0;
    for (const v of this.successByWaypoint.values()) sum += v;
    return sum;
  }

  /** Wipe all memory — called on simulation reset. */
  clear(): void {
    this.successByWaypoint.clear();
    this.lastDecayAt = 0;
  }

  /** Snapshot for tests and debug. */
  entries(): Array<[string, number]> {
    return Array.from(this.successByWaypoint.entries());
  }
}

export const peerMemory = new PeerMemory();
