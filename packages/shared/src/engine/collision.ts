import { RACK_BOUNDS, RackBounds } from '../data/warehouseLayout';

/**
 * Minimum center-to-center distance between two AMRs. 
 * AMR visual radius is ~0.4; doubled for safe separation.
 */
export const AMR_SAFE_DISTANCE = 0.9;

/**
 * Hard distance at which AMRs are considered in a physical overlap. 
 * Used for emergency separation only.
 */
export const AMR_OVERLAP_DISTANCE = 0.6;

/**
 * Returns the first rack (if any) whose expanded AABB contains 
 * the given point.
 */
export function getRackAt(x: number, z: number): RackBounds | null {
  for (const r of RACK_BOUNDS) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      return r;
    }
  }
  return null;
}

/**
 * Returns all racks whose expanded AABB contains the given point.
 * (Racks don't overlap in the current layout, but this is future-
 * proof.)
 */
export function getRacksAt(x: number, z: number): RackBounds[] {
  return RACK_BOUNDS.filter(
    (r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ
  );
}

/**
 * Returns true if the point lies inside any rack's expanded AABB.
 */
export function pointHitsRack(x: number, z: number): boolean {
  return getRackAt(x, z) !== null;
}

/**
 * Segment-vs-AABB intersection test using the Liang-Barsky 
 * clipping algorithm. Returns the first rack hit by the segment, 
 * or null if the path is clear.
 *
 * The segment is from (x1, z1) to (x2, z2), treated as a ray with 
 * parameter t in [0, 1]. Closed intervals on both endpoints — a 
 * segment that grazes a corner counts as a hit.
 */
export function segmentHitsRack(
  x1: number,
  z1: number,
  x2: number,
  z2: number
): RackBounds | null {
  const dx = x2 - x1;
  const dz = z2 - z1;

  let best: RackBounds | null = null;
  let bestT = Infinity;

  for (const r of RACK_BOUNDS) {
    const t = segmentIntersectsAABB(
      x1, z1, dx, dz,
      r.minX, r.maxX, r.minZ, r.maxZ
    );
    if (t !== null && t < bestT) {
      bestT = t;
      best = r;
    }
  }
  return best;
}

/**
 * Liang-Barsky. Returns the entry parameter t (0..1) if the segment 
 * intersects the AABB, or null if it misses entirely.
 */
function segmentIntersectsAABB(
  x0: number,
  z0: number,
  dx: number,
  dz: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): number | null {
  // Avoid division by zero: use an epsilon-safe comparison.
  const EPS = 1e-9;
  let tMin = 0;
  let tMax = 1;

  // X slab
  if (Math.abs(dx) < EPS) {
    // Segment parallel to Z axis; must be within [minX, maxX] to hit
    if (x0 < minX || x0 > maxX) return null;
  } else {
    const t1 = (minX - x0) / dx;
    const t2 = (maxX - x0) / dx;
    const tEnter = Math.min(t1, t2);
    const tExit = Math.max(t1, t2);
    tMin = Math.max(tMin, tEnter);
    tMax = Math.min(tMax, tExit);
    if (tMin > tMax) return null;
  }

  // Z slab
  if (Math.abs(dz) < EPS) {
    if (z0 < minZ || z0 > maxZ) return null;
  } else {
    const t1 = (minZ - z0) / dz;
    const t2 = (maxZ - z0) / dz;
    const tEnter = Math.min(t1, t2);
    const tExit = Math.max(t1, t2);
    tMin = Math.max(tMin, tEnter);
    tMax = Math.min(tMax, tExit);
    if (tMin > tMax) return null;
  }

  // Both slabs overlapped; segment enters AABB at t = tMin
  return tMin;
}

/**
 * Distance between two 2D points, ignoring Y.
 */
export function planarDistance(
  a: { x: number; z: number },
  b: { x: number; z: number }
): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/**
 * Are two AMRs within the physical overlap threshold?
 */
export function robotsOverlap(
  a: { x: number; z: number },
  b: { x: number; z: number }
): boolean {
  return planarDistance(a, b) < AMR_OVERLAP_DISTANCE;
}

/**
 * Are two AMRs within the "should yield" distance?
 */
export function robotsShouldYield(
  a: { x: number; z: number },
  b: { x: number; z: number }
): boolean {
  return planarDistance(a, b) < AMR_SAFE_DISTANCE;
}

/**
 * Nearest rack to a point (by distance to AABB surface). Used by 
 * task selection to avoid sending AMRs into tight corners.
 */
export function nearestRackDistance(x: number, z: number): number {
  let min = Infinity;
  for (const r of RACK_BOUNDS) {
    const dx = Math.max(r.minX - x, 0, x - r.maxX);
    const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
    const d = Math.hypot(dx, dz);
    if (d < min) min = d;
  }
  return min;
}
