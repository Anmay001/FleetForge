const DEPOSIT_AMOUNT = 0.35;   // per traversal
const DECAY_PER_SEC = 0.08;    // 8% per second (fast evaporation)
const MAX_PHEROMONE = 1.0;

/**
 * Classification of a traversal's "productive value". Modulates 
 * how much pheromone gets deposited.
 *
 * Higher multipliers reinforce paths that lead to successful work.
 * Retreats (yielding, returning empty) get little or no deposit.
 */
export type TraversalOutcome =
  | 'CARRYING'        // 1.5× — most productive (delivering payload)
  | 'HEADING_PICKUP'  // 1.0× — normal productive motion
  | 'GOING_CHARGE'    // 0.3× — necessary but not productive
  | 'YIELDING'        // 0.0× — retreat, don't reinforce
  | 'IDLE_RETURN';    // 0.5× — returning to idle state

const OUTCOME_MULTIPLIER: Record<TraversalOutcome, number> = {
  CARRYING: 1.5,
  HEADING_PICKUP: 1.0,
  GOING_CHARGE: 0.3,
  YIELDING: 0.0,
  IDLE_RETURN: 0.5,
};

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

  /**
   * Deposit pheromone scaled by the traversal's outcome.
   * Yielding deposits nothing — retreats should not reinforce.
   */
  depositOutcome(
    fromId: string,
    toId: string,
    outcome: TraversalOutcome
  ): void {
    const multiplier = OUTCOME_MULTIPLIER[outcome];
    if (multiplier <= 0) return;
    const key = segmentKey(fromId, toId);
    const current = this.trail.get(key) ?? 0;
    const next = Math.min(
      MAX_PHEROMONE,
      current + DEPOSIT_AMOUNT * multiplier
    );
    this.trail.set(key, next);
  }

  /**
   * Given a list of candidate segment keys, return a 
   * pheromone-weighted random pick. Higher-pheromone segments are 
   * more likely to be chosen, but never deterministically — this 
   * preserves exploration (avoids the Artificial Hivemind 
   * homogeneity collapse from NeurIPS 2025).
   *
   * Returns the index of the chosen candidate, or -1 if the list 
   * is empty.
   */
  weightedPick(candidateKeys: string[]): number {
    if (candidateKeys.length === 0) return -1;

    const weights: number[] = candidateKeys.map((key) => {
      const level = this.trail.get(key) ?? 0;
      // Baseline weight of 1.0 keeps unpheromoned paths explorable
      return 1.0 + level * 4.0;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] ?? 0;
      r -= w;
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  /**
   * Sum of all pheromone levels across all segments. Useful for 
   * checking that decay is working.
   */
  totalPheromone(): number {
    let sum = 0;
    for (const v of this.trail.values()) sum += v;
    return sum;
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
