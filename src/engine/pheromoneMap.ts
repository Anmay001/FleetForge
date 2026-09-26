const DEPOSIT_AMOUNT = 0.35;   // per traversal
const DECAY_PER_SEC = 0.08;    // 8% per second (fast evaporation)
const MAX_PHEROMONE = 1.0;

// Canonical key: alphabetically sorted so (A,B) === (B,A)
export function segmentKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

class PheromoneMap {
  private trail: Map<string, number> = new Map();
  private lastDecayAt: number = 0;

  /** Deposit pheromone on a segment after a robot traverses it. */
  deposit(fromId: string, toId: string, amount: number = DEPOSIT_AMOUNT): void {
    const key = segmentKey(fromId, toId);
    const current = this.trail.get(key) ?? 0;
    const next = Math.min(MAX_PHEROMONE, current + amount);
    this.trail.set(key, next);
  }

  /** Read current pheromone level (0 if never visited). */
  get(fromId: string, toId: string): number {
    return this.trail.get(segmentKey(fromId, toId)) ?? 0;
  }

  /** Evaporate all trails based on elapsed time. Call ~2 Hz. */
  decay(nowMs: number): void {
    if (this.lastDecayAt === 0) {
      this.lastDecayAt = nowMs;
      return;
    }
    const dtSec = (nowMs - this.lastDecayAt) / 1000;
    this.lastDecayAt = nowMs;
    if (dtSec <= 0) return;

    const factor = Math.max(0, 1 - DECAY_PER_SEC * dtSec);
    for (const [key, value] of this.trail.entries()) {
      const next = value * factor;
      if (next < 0.01) {
        this.trail.delete(key);
      } else {
        this.trail.set(key, next);
      }
    }
  }

  /** Diagnostics */
  size(): number {
    return this.trail.size;
  }

  /** Reset all pheromones (used on simulation reset). */
  clear(): void {
    this.trail.clear();
    this.lastDecayAt = 0;
  }

  /** Snapshot for debugging */
  entries(): Array<[string, number]> {
    return Array.from(this.trail.entries());
  }
}

export const pheromoneMap = new PheromoneMap();
