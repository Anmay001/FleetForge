import { describe, it, expect, beforeEach } from 'vitest';
import { routeRegistry } from '@fleetforge/shared';

describe('routeRegistry segment locks', () => {
  beforeEach(() => {
    routeRegistry.clear();
  });

  it('acquires a free segment', () => {
    expect(
      routeRegistry.lockSegment('A', 'B', 'AMR-01')
    ).toBe(true);
    expect(routeRegistry.segmentOwner('A', 'B')).toBe('AMR-01');
  });

  it('is symmetric — A→B and B→A are the same lock', () => {
    routeRegistry.lockSegment('A', 'B', 'AMR-01');
    expect(routeRegistry.segmentOwner('B', 'A')).toBe('AMR-01');
  });

  it('refuses a locked segment owned by another robot', () => {
    routeRegistry.lockSegment('A', 'B', 'AMR-01');
    expect(
      routeRegistry.lockSegment('A', 'B', 'AMR-02')
    ).toBe(false);
    expect(routeRegistry.segmentOwner('A', 'B')).toBe('AMR-01');
  });

  it('allows re-locking by the same robot', () => {
    routeRegistry.lockSegment('A', 'B', 'AMR-01');
    expect(
      routeRegistry.lockSegment('A', 'B', 'AMR-01')
    ).toBe(true);
  });

  it('releases only for the owning robot', () => {
    routeRegistry.lockSegment('A', 'B', 'AMR-01');
    routeRegistry.releaseSegment('A', 'B', 'AMR-02');
    expect(routeRegistry.segmentOwner('A', 'B')).toBe('AMR-01');

    routeRegistry.releaseSegment('A', 'B', 'AMR-01');
    expect(routeRegistry.segmentOwner('A', 'B')).toBeNull();
  });

  it('clearRobotReservations wipes segments too', () => {
    routeRegistry.lockSegment('A', 'B', 'AMR-01');
    routeRegistry.lockSegment('C', 'D', 'AMR-01');
    routeRegistry.lockSegment('E', 'F', 'AMR-02');

    routeRegistry.clearRobotReservations('AMR-01');

    expect(routeRegistry.segmentOwner('A', 'B')).toBeNull();
    expect(routeRegistry.segmentOwner('C', 'D')).toBeNull();
    expect(routeRegistry.segmentOwner('E', 'F')).toBe('AMR-02');
  });

  it('exposes segment lock count for diagnostics', () => {
    expect(routeRegistry.segmentLockCount()).toBe(0);
    routeRegistry.lockSegment('A', 'B', 'AMR-01');
    routeRegistry.lockSegment('C', 'D', 'AMR-01');
    expect(routeRegistry.segmentLockCount()).toBe(2);
  });
});
