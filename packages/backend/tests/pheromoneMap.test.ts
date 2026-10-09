import { describe, it, expect, beforeEach } from 'vitest';
import { pheromoneMap, segmentKey } from '@fleetforge/shared';

describe('pheromoneMap outcome-weighted deposits', () => {
  beforeEach(() => {
    pheromoneMap.clear();
  });

  it('depositOutcome scales by outcome type', () => {
    pheromoneMap.depositOutcome('A', 'B', 'HEADING_PICKUP');
    const heading = pheromoneMap.get('A', 'B');

    pheromoneMap.clear();
    pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    const carrying = pheromoneMap.get('A', 'B');

    expect(carrying).toBeGreaterThan(heading);
  });

  it('YIELDING deposits nothing', () => {
    pheromoneMap.depositOutcome('A', 'B', 'YIELDING');
    expect(pheromoneMap.get('A', 'B')).toBe(0);
  });

  it('GOING_CHARGE deposits less than HEADING_PICKUP', () => {
    pheromoneMap.depositOutcome('A', 'B', 'GOING_CHARGE');
    const charge = pheromoneMap.get('A', 'B');

    pheromoneMap.clear();
    pheromoneMap.depositOutcome('A', 'B', 'HEADING_PICKUP');
    const pickup = pheromoneMap.get('A', 'B');

    expect(charge).toBeLessThan(pickup);
  });

  it('repeated CARRYING deposits saturate at MAX_PHEROMONE', () => {
    for (let i = 0; i < 20; i++) {
      pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    }
    expect(pheromoneMap.get('A', 'B')).toBeLessThanOrEqual(1.0);
  });
});

describe('pheromoneMap weightedPick', () => {
  beforeEach(() => {
    pheromoneMap.clear();
  });

  it('returns -1 for empty candidate list', () => {
    expect(pheromoneMap.weightedPick([])).toBe(-1);
  });

  it('returns an index within bounds', () => {
    const idx = pheromoneMap.weightedPick(['A|B', 'B|C', 'C|D']);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });

  it('biases toward higher-pheromone segments over many trials', () => {
    // Deposit heavily on A|B, none on the others
    for (let i = 0; i < 5; i++) {
      pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    }
    const key1 = segmentKey('A', 'B');
    const key2 = segmentKey('B', 'C');
    const key3 = segmentKey('C', 'D');

    const picks = { 0: 0, 1: 0, 2: 0 };
    for (let i = 0; i < 1000; i++) {
      const idx = pheromoneMap.weightedPick([key1, key2, key3]);
      picks[idx as 0 | 1 | 2]++;
    }

    // A|B should win the clear majority
    expect(picks[0]).toBeGreaterThan(500);
  });

  it('unpheromoned paths still get picked sometimes (exploration)', () => {
    for (let i = 0; i < 5; i++) {
      pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    }
    const key1 = segmentKey('A', 'B');
    const key2 = segmentKey('B', 'C');

    let unpheromonedPicks = 0;
    for (let i = 0; i < 1000; i++) {
      if (pheromoneMap.weightedPick([key1, key2]) === 1) {
        unpheromonedPicks++;
      }
    }
    // Should be picked sometimes — not never
    expect(unpheromonedPicks).toBeGreaterThan(50);
  });
});

describe('pheromoneMap totalPheromone', () => {
  beforeEach(() => {
    pheromoneMap.clear();
  });

  it('is 0 on empty map', () => {
    expect(pheromoneMap.totalPheromone()).toBe(0);
  });

  it('sums all trail values', () => {
    pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    pheromoneMap.depositOutcome('C', 'D', 'CARRYING');
    expect(pheromoneMap.totalPheromone()).toBeGreaterThan(0);
  });
});
