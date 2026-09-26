import { WAYPOINT_GRAPH } from './waypointGraph';
import { pheromoneMap } from './pheromoneMap';
import { LANES } from '../data/warehouseLayout';

// How much pheromone penalizes a segment. Cost = base + (pheromone × factor)
const PHEROMONE_COST_FACTOR = 6.0;

// Extra penalty for a segment reserved by another robot (avoid conflict)
const RESERVED_SEGMENT_PENALTY = 100.0;

// Extra penalty for a waypoint currently occupied by another robot
const OCCUPIED_WAYPOINT_PENALTY = 50.0;

export interface PlannerContext {
  // Segment keys ("A|B") that another robot has reserved
  reservedSegments: Set<string>;
  // Waypoint IDs currently occupied, mapped to the robot holding
  // each one
  occupiedWaypoints: Map<string, string>;
  // The requesting robot's own ID (so we don't penalize ourselves)
  selfId: string;
}

/** Segment key helper — mirrors pheromoneMap's canonical form. */
function canonicalSegment(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Euclidean distance between two waypoints (used as A* heuristic). */
function heuristic(aId: string, bId: string): number {
  const a = WAYPOINT_GRAPH[aId];
  const b = WAYPOINT_GRAPH[bId];
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Compute cost of moving from `fromId` to `toId`. */
function edgeCost(
  fromId: string,
  toId: string,
  ctx: PlannerContext
): number {
  const base = heuristic(fromId, toId);
  const pheromone = pheromoneMap.get(fromId, toId);
  let cost = base * (1 + pheromone * PHEROMONE_COST_FACTOR);

  const key = canonicalSegment(fromId, toId);
  if (ctx.reservedSegments.has(key)) {
    cost += RESERVED_SEGMENT_PENALTY;
  }
  const occupant = ctx.occupiedWaypoints.get(toId);
  if (occupant && occupant !== ctx.selfId) {
    cost += OCCUPIED_WAYPOINT_PENALTY;
  }
  return cost;
}

/**
 * A* search from startId to goalId.
 * Returns array of waypoint IDs [start, ..., goal] or null.
 */
export function planRoute(
  startId: string,
  goalId: string,
  ctx: PlannerContext
): string[] | null {
  if (startId === goalId) return [startId];
  if (!WAYPOINT_GRAPH[startId] || !WAYPOINT_GRAPH[goalId]) return null;

  const openSet = new Set<string>([startId]);
  const cameFrom: Record<string, string | null> = { [startId]: null };
  const gScore: Record<string, number> = { [startId]: 0 };
  const fScore: Record<string, number> = {
    [startId]: heuristic(startId, goalId),
  };

  while (openSet.size > 0) {
    // Find the node in openSet with lowest fScore
    let current: string | null = null;
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = fScore[id] ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    }
    if (current === null) break;

    if (current === goalId) {
      // Reconstruct path
      const path: string[] = [];
      let node: string | null = current;
      while (node !== null) {
        path.unshift(node);
        node = cameFrom[node];
      }
      return path;
    }

    openSet.delete(current);
    const node = WAYPOINT_GRAPH[current];
    if (!node) continue;

    for (const neighbor of node.neighbors) {
      const tentativeG =
        (gScore[current] ?? Infinity) +
        edgeCost(current, neighbor, ctx);

      if (tentativeG < (gScore[neighbor] ?? Infinity)) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = tentativeG + heuristic(neighbor, goalId);
        openSet.add(neighbor);
      }
    }
  }

  return null;
}

/**
 * Sanity check: are all neighbours of a waypoint on an actual lane?
 * (Both share x or z within tolerance.) Used by the coordinator to
 * verify the graph hasn't been corrupted.
 */
export function validateLaneAlignment(): boolean {
  const TOL = 0.2;
  for (const wp of Object.values(WAYPOINT_GRAPH)) {
    for (const neighborId of wp.neighbors) {
      const nb = WAYPOINT_GRAPH[neighborId];
      if (!nb) return false;
      const sameX = Math.abs(wp.x - nb.x) < TOL;
      const sameZ = Math.abs(wp.z - nb.z) < TOL;
      if (!sameX && !sameZ) return false;
    }
  }
  // Also verify every waypoint is on a lane
  for (const wp of Object.values(WAYPOINT_GRAPH)) {
    const onXLane = LANES.x.some((lx) => Math.abs(lx - wp.x) < TOL);
    const onZLane = LANES.z.some((lz) => Math.abs(lz - wp.z) < TOL);
    if (!onXLane && !onZLane) return false;
  }
  return true;
}
