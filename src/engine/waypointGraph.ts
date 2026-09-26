/// <reference types="vite/client" />
import { WAYPOINTS } from '../data/warehouseLayout';

export interface GraphNode {
  id: string;
  x: number;
  z: number;
  neighbors: string[];  // adjacent waypoint IDs on the same lane
}

// Build graph at module load. Two waypoints are neighbors if:
// - they share the same X (within tolerance) AND their Z differs by
//   exactly one lane step (4 units)
// - OR they share the same Z AND their X differs by one lane step
// - OR one coordinate matches and the other differs by one lane step
// Only connect waypoints that are adjacent on the lane grid.
export const WAYPOINT_GRAPH: Record<string, GraphNode> = (() => {
  const graph: Record<string, GraphNode> = {};

  for (const wp of WAYPOINTS) {
    graph[wp.id] = {
      id: wp.id,
      x: wp.x,
      z: wp.z,
      neighbors: [],
    };
  }

  const TOL = 0.1;
  const LANE_STEP = 4;

  function areAligned(
    a: { x: number; z: number },
    b: { x: number; z: number }
  ): boolean {
    const sameX = Math.abs(a.x - b.x) < TOL;
    const sameZ = Math.abs(a.z - b.z) < TOL;
    if (!sameX && !sameZ) return false;

    // Gap must be a positive multiple of LANE_STEP
    const gap = sameX
      ? Math.abs(a.z - b.z)
      : Math.abs(a.x - b.x);
    if (gap < TOL) return false;
    const ratio = gap / LANE_STEP;
    return Math.abs(ratio - Math.round(ratio)) < 0.01;
  }

  // No other waypoint sits strictly between a and b on the same lane
  function hasWaypointBetween(
    a: { id: string; x: number; z: number },
    b: { id: string; x: number; z: number }
  ): boolean {
    const sameX = Math.abs(a.x - b.x) < TOL;
    for (const w of WAYPOINTS) {
      if (w.id === a.id || w.id === b.id) continue;
      if (sameX) {
        if (Math.abs(w.x - a.x) > TOL) continue;
        const minZ = Math.min(a.z, b.z);
        const maxZ = Math.max(a.z, b.z);
        if (w.z > minZ + TOL && w.z < maxZ - TOL) return true;
      } else {
        if (Math.abs(w.z - a.z) > TOL) continue;
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        if (w.x > minX + TOL && w.x < maxX - TOL) return true;
      }
    }
    return false;
  }

  for (const a of WAYPOINTS) {
    for (const b of WAYPOINTS) {
      if (a.id === b.id) continue;
      if (!areAligned(a, b)) continue;
      if (hasWaypointBetween(a, b)) continue;
      graph[a.id].neighbors.push(b.id);
    }
  }

  return graph;
})();

/**
 * BFS shortest path from startId to goalId. Returns the sequence of
 * waypoint IDs INCLUDING both endpoints, or null if unreachable.
 */
export function findPath(
  startId: string,
  goalId: string
): string[] | null {
  if (startId === goalId) return [startId];
  if (!WAYPOINT_GRAPH[startId] || !WAYPOINT_GRAPH[goalId]) return null;

  const queue: string[] = [startId];
  const cameFrom: Record<string, string | null> = { [startId]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === goalId) {
      // reconstruct
      const path: string[] = [];
      let node: string | null = goalId;
      while (node !== null) {
        path.unshift(node);
        node = cameFrom[node];
      }
      return path;
    }
    for (const neighbor of WAYPOINT_GRAPH[current].neighbors) {
      if (!(neighbor in cameFrom)) {
        cameFrom[neighbor] = current;
        queue.push(neighbor);
      }
    }
  }
  return null;
}

/**
 * Snap an arbitrary world position to the nearest waypoint ID.
 */
export function snapToWaypoint(x: number, z: number): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const wp of WAYPOINTS) {
    const d = Math.hypot(wp.x - x, wp.z - z);
    if (d < bestDist) {
      bestDist = d;
      bestId = wp.id;
    }
  }
  return bestId;
}
