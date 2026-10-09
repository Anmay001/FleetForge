import { describe, it, expect } from 'vitest';
import {
  RACK_BOUNDS,
  RACK_SAFETY_MARGIN,
  pointHitsRack,
  getRackAt,
  getRacksAt,
  segmentHitsRack,
  planarDistance,
  robotsOverlap,
  robotsShouldYield,
  nearestRackDistance,
} from '@fleetforge/shared';

describe('collision primitives', () => {
  it('RACK_BOUNDS has one entry per rack', () => {
    // The warehouse layout defines 8 racks
    expect(RACK_BOUNDS.length).toBe(8);
  });

  it('RACK_BOUNDS are expanded by the safety margin', () => {
    const first = RACK_BOUNDS[0];
    expect(first.minX).toBeCloseTo(first.rawMinX - RACK_SAFETY_MARGIN, 5);
    expect(first.maxX).toBeCloseTo(first.rawMaxX + RACK_SAFETY_MARGIN, 5);
    expect(first.minZ).toBeCloseTo(first.rawMinZ - RACK_SAFETY_MARGIN, 5);
    expect(first.maxZ).toBeCloseTo(first.rawMaxZ + RACK_SAFETY_MARGIN, 5);
  });

  it('pointHitsRack is true inside a rack, false on a lane', () => {
    // Center of RACK-A1 (from warehouse layout) is inside its bounds
    const rack = RACK_BOUNDS[0];
    const cx = (rack.rawMinX + rack.rawMaxX) / 2;
    const cz = (rack.rawMinZ + rack.rawMaxZ) / 2;
    expect(pointHitsRack(cx, cz)).toBe(true);

    // Lane intersections (x=2,z=2), (x=6,z=2), etc. should be clear
    expect(pointHitsRack(2, 2)).toBe(false);
    expect(pointHitsRack(10, 10)).toBe(false);
    expect(pointHitsRack(18, 18)).toBe(false);
  });

  it('getRackAt returns the specific rack on a hit', () => {
    const rack = RACK_BOUNDS[0];
    const cx = (rack.rawMinX + rack.rawMaxX) / 2;
    const cz = (rack.rawMinZ + rack.rawMaxZ) / 2;
    const hit = getRackAt(cx, cz);
    expect(hit?.id).toBe(rack.id);
  });

  it('getRacksAt returns empty array on a lane', () => {
    expect(getRacksAt(10, 10)).toEqual([]);
  });

  it('segmentHitsRack is null for a clear lane segment', () => {
    // Vertical lane at x=2 from z=2 to z=18 — entirely on lanes
    expect(segmentHitsRack(2, 2, 2, 18)).toBeNull();
    // Horizontal lane at z=2 from x=2 to x=18
    expect(segmentHitsRack(2, 2, 18, 2)).toBeNull();
  });

  it('segmentHitsRack detects a crossing through a rack', () => {
    // Rack A1 spans roughly x=[3,5], z=[3,5] (from warehouse layout).
    // A segment from (2, 4) to (6, 4) crosses through the rack.
    const hit = segmentHitsRack(2, 4, 6, 4);
    expect(hit).not.toBeNull();
  });

  it('segmentHitsRack detects a graze along the AABB edge', () => {
    const rack = RACK_BOUNDS[0];
    // Start just outside left edge, end just past right edge, at the 
    // rack's center Z. Closed-interval semantics → should hit.
    const cz = (rack.rawMinZ + rack.rawMaxZ) / 2;
    const hit = segmentHitsRack(
      rack.minX - 0.5,
      cz,
      rack.maxX + 0.5,
      cz
    );
    expect(hit?.id).toBe(rack.id);
  });

  it('planarDistance is correct for axis and diagonal', () => {
    expect(planarDistance({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
    expect(planarDistance({ x: 1, z: 1 }, { x: 1, z: 5 })).toBe(4);
  });

  it('robotsOverlap is true for very close positions', () => {
    expect(robotsOverlap({ x: 0, z: 0 }, { x: 0.3, z: 0 })).toBe(true);
    expect(robotsOverlap({ x: 0, z: 0 }, { x: 1.0, z: 0 })).toBe(false);
  });

  it('robotsShouldYield uses the safe distance threshold', () => {
    expect(robotsShouldYield({ x: 0, z: 0 }, { x: 0.8, z: 0 })).toBe(true);
    expect(robotsShouldYield({ x: 0, z: 0 }, { x: 1.2, z: 0 })).toBe(false);
  });

  it('nearestRackDistance is 0 inside a rack and positive on a lane', () => {
    const rack = RACK_BOUNDS[0];
    const cx = (rack.rawMinX + rack.rawMaxX) / 2;
    const cz = (rack.rawMinZ + rack.rawMaxZ) / 2;
    expect(nearestRackDistance(cx, cz)).toBe(0);
    // Lane intersection at (10, 10) is between racks — positive distance
    expect(nearestRackDistance(10, 10)).toBeGreaterThan(0);
  });
});
