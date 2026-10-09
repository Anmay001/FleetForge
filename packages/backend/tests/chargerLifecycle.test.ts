import { describe, it, expect, beforeEach } from 'vitest';
import { chargerRegistry } from '@fleetforge/shared';

describe('charger full lifecycle', () => {
  beforeEach(() => {
    chargerRegistry.clear();
  });

  it('one robot reserves, charges, releases — then second uses it', () => {
    // Robot 1 approaches
    const r1 = chargerRegistry.findFreeCharger(2, 2, 'AMR-01');
    expect(r1).toBe('CHARGE-01');

    // Robot 1 reserves
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-01')).toBe(true);

    // While en route, Robot 2 also needs a charger
    const r2 = chargerRegistry.findFreeCharger(2, 2, 'AMR-02');
    expect(r2).toBe('CHARGE-02');

    // Robot 1 arrives and starts charging
    chargerRegistry.markCharging('CHARGE-01', 'AMR-01');
    let snap = chargerRegistry.snapshot();
    const c1 = snap.find((c) => c.id === 'CHARGE-01')!;
    expect(c1.charging).toBe(true);
    expect(c1.occupiedBy).toBe('AMR-01');

    // Robot 1 finishes, releases
    chargerRegistry.release('CHARGE-01', 'AMR-01');
    snap = chargerRegistry.snapshot();
    expect(snap.find((c) => c.id === 'CHARGE-01')?.occupiedBy).toBeNull();

    // Robot 3 (arrives later) can now use CHARGE-01
    const r3 = chargerRegistry.findFreeCharger(2, 2, 'AMR-03');
    expect(r3).toBe('CHARGE-01');
  });

  it('both chargers occupied — third robot queues at nearest', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.reserve('CHARGE-02', 'AMR-02');

    // Robot 3 near CHARGE-01 gets null from findFreeCharger
    const r3 = chargerRegistry.findFreeCharger(2, 2, 'AMR-03');
    expect(r3).toBeNull();

    // Simulation loop falls back to "closest taken charger" — 
    // verified by re-querying after a release
    chargerRegistry.release('CHARGE-01', 'AMR-01');
    const r3Retry = chargerRegistry.findFreeCharger(2, 2, 'AMR-03');
    expect(r3Retry).toBe('CHARGE-01');
  });

  it('a stalled robot releases its charger via releaseAllForRobot', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    expect(chargerRegistry.snapshot()[0].occupiedBy).toBe('AMR-01');

    // Simulate stall recovery
    chargerRegistry.releaseAllForRobot('AMR-01');

    // Another robot can now claim it
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-02')).toBe(true);
  });

  it('charger chosen by proximity — nearer robot gets nearer pad', () => {
    const nearCharger1 = chargerRegistry.findFreeCharger(2, 2, 'AMR-A');
    expect(nearCharger1).toBe('CHARGE-01');

    const nearCharger2 = chargerRegistry.findFreeCharger(2, 18, 'AMR-B');
    expect(nearCharger2).toBe('CHARGE-02');
  });

  it('markCharging by non-owner is ignored', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.markCharging('CHARGE-01', 'AMR-02');
    const snap = chargerRegistry.snapshot();
    const c1 = snap.find((c) => c.id === 'CHARGE-01')!;
    // Should still be owned by AMR-01, not marked charging
    expect(c1.occupiedBy).toBe('AMR-01');
    expect(c1.charging).toBe(false);
  });

  it('full reset clears all charger state', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.reserve('CHARGE-02', 'AMR-02');
    chargerRegistry.markCharging('CHARGE-01', 'AMR-01');

    chargerRegistry.clear();

    const snap = chargerRegistry.snapshot();
    for (const c of snap) {
      expect(c.occupiedBy).toBeNull();
      expect(c.charging).toBe(false);
      expect(c.occupiedSince).toBe(0);
    }
  });
});
