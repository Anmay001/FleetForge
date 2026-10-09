import { describe, it, expect, beforeEach } from 'vitest';
import { chargerRegistry } from '@fleetforge/shared';

describe('chargerRegistry', () => {
  beforeEach(() => {
    chargerRegistry.clear();
  });

  it('finds a free charger', () => {
    const id = chargerRegistry.findFreeCharger(2, 2, 'AMR-01');
    expect(id).toBe('CHARGE-01');
  });

  it('reserves a charger and blocks other robots', () => {
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-01')).toBe(true);
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-02')).toBe(false);
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-01')).toBe(true);
  });

  it('finds a free charger when the nearest is taken', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    const id = chargerRegistry.findFreeCharger(2, 2, 'AMR-02');
    // AMR-02 near CHARGE-01 (at 2,2) but CHARGE-01 is taken → 
    // must return CHARGE-02
    expect(id).toBe('CHARGE-02');
  });

  it('returns null when all chargers are taken', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.reserve('CHARGE-02', 'AMR-02');
    const id = chargerRegistry.findFreeCharger(2, 2, 'AMR-03');
    expect(id).toBeNull();
  });

  it('a robot can still find its own reserved charger', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    const id = chargerRegistry.findFreeCharger(2, 2, 'AMR-01');
    expect(id).toBe('CHARGE-01');
  });

  it('release frees the charger for other robots', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.release('CHARGE-01', 'AMR-01');
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-02')).toBe(true);
  });

  it('release only works for the owner', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.release('CHARGE-01', 'AMR-02');
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-03')).toBe(false);
  });

  it('markCharging flags arrival', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.markCharging('CHARGE-01', 'AMR-01');
    const snap = chargerRegistry.snapshot();
    const c = snap.find((s) => s.id === 'CHARGE-01');
    expect(c?.charging).toBe(true);
  });

  it('releaseAllForRobot clears all occupancy for that robot', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    chargerRegistry.reserve('CHARGE-02', 'AMR-01');
    chargerRegistry.releaseAllForRobot('AMR-01');
    expect(chargerRegistry.reserve('CHARGE-01', 'AMR-02')).toBe(true);
    expect(chargerRegistry.reserve('CHARGE-02', 'AMR-03')).toBe(true);
  });

  it('snapshot reflects current state', () => {
    chargerRegistry.reserve('CHARGE-01', 'AMR-01');
    const snap = chargerRegistry.snapshot();
    expect(snap.length).toBe(2);
    expect(snap.find((s) => s.id === 'CHARGE-01')?.occupiedBy).toBe('AMR-01');
    expect(snap.find((s) => s.id === 'CHARGE-02')?.occupiedBy).toBeNull();
  });
});
