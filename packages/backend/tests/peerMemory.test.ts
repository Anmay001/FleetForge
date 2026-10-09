import { describe, it, expect, beforeEach } from 'vitest';
import { peerMemory } from '@fleetforge/shared';

describe('peerMemory', () => {
  beforeEach(() => {
    peerMemory.clear();
  });

  it('returns 0 for unknown waypoints', () => {
    expect(peerMemory.weight('RACK-A1')).toBe(0);
  });

  it('records success increments the weight', () => {
    peerMemory.recordSuccess('DROP-01');
    expect(peerMemory.weight('DROP-01')).toBe(1.0);
    peerMemory.recordSuccess('DROP-01');
    expect(peerMemory.weight('DROP-01')).toBe(2.0);
  });

  it('saturates at 5.0', () => {
    for (let i = 0; i < 20; i++) {
      peerMemory.recordSuccess('DROP-01');
    }
    expect(peerMemory.weight('DROP-01')).toBe(5.0);
  });

  it('decay reduces weights over time', () => {
    peerMemory.recordSuccess('DROP-01');
    peerMemory.decay(1000);
    peerMemory.decay(11000); // 10 seconds later
    // 5% per second × 10 s = ~40% remaining
    expect(peerMemory.weight('DROP-01')).toBeLessThan(1.0);
    expect(peerMemory.weight('DROP-01')).toBeGreaterThan(0.3);
  });

  it('decay prunes near-zero entries', () => {
    peerMemory.recordSuccess('DROP-01');
    peerMemory.decay(1000);
    peerMemory.decay(20000); // 19 s later
    // Well below 0.05 pruning threshold
    expect(peerMemory.weight('DROP-01')).toBe(0);
  });

  it('clear wipes everything', () => {
    peerMemory.recordSuccess('DROP-01');
    peerMemory.recordSuccess('DROP-02');
    peerMemory.clear();
    expect(peerMemory.weight('DROP-01')).toBe(0);
    expect(peerMemory.weight('DROP-02')).toBe(0);
    expect(peerMemory.total()).toBe(0);
  });

  it('entries reflects current state', () => {
    peerMemory.recordSuccess('DROP-01');
    peerMemory.recordSuccess('DROP-02');
    const entries = peerMemory.entries();
    expect(entries.length).toBe(2);
  });
});
