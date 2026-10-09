import type { AMR, Waypoint } from '../types/fleet';
import { WAYPOINT_GRAPH, type GraphNode } from './waypointGraph';
import { pheromoneMap } from './pheromoneMap';
import { peerMemory } from './peerMemory';

/**
 * A scored candidate destination.
 */
export interface DestinationCandidate {
  waypoint: Waypoint;
  score: number;
}

/**
 * Inputs to the scorer. All positions are in warehouse world 
 * coordinates (meters, origin at warehouse corner).
 */
export interface SelectionContext {
  /** The waypoint the robot is currently nearest to. Used for 
   *  pheromone lookup on the first segment. */
  startWaypointId: string;
  /** Robot's actual world position — may be between waypoints. */
  startX: number;
  startZ: number;
  /** All robots (including self). The scorer skips self. */
  robots: AMR[];
  /** Self's robot ID — used to exclude self from congestion count. */
  selfId: string;
  /** Minimum Euclidean distance to a candidate for it to be valid. */
  minDistance: number;
  /** Optional graph override (useful for testing with custom/mock waypoints). */
  graph?: Record<string, GraphNode>;
}

export interface SelectionOptions {
  /** Radius around a candidate within which robots count as 
   *  "congestion". Default 3.0 m. */
  congestionRadius: number;
  /** How strongly to penalize crowded destinations. Higher = more 
   *  dispersion. Default 1.5. */
  congestionWeight: number;
  /** How strongly to prefer farther destinations (spreads fleet). 
   *  Default 0.05 (5% per meter, capped at 20 m). */
  distanceWeight: number;
  /** How strongly to prefer segments that have active pheromone. 
   *  Default 4.0. */
  pheromoneWeight: number;
  /** How strongly to prefer destinations with recent delivery 
   *  success (Maynard-Cross imitation). Default 2.0. */
  imitationWeight: number;
  /** How strongly to penalize destinations already targeted by 
   *  other robots. Default 1.8. */
  peerDestinationPenalty: number;
}

const DEFAULT_OPTIONS: SelectionOptions = {
  congestionRadius: 3.0,
  congestionWeight: 1.5,
  distanceWeight: 0.05,
  pheromoneWeight: 4.0,
  imitationWeight: 2.0,
  peerDestinationPenalty: 1.8,
};

/**
 * Score each candidate destination. Higher = more attractive.
 *
 * Score = pheromoneBoost × congestionPenalty × distanceBonus
 *
 *  - pheromoneBoost:    1 + pheromone × pheromoneWeight
 *                       (baseline 1 so unpheromoned paths remain 
 *                        explorable)
 *  - congestionPenalty: 1 / (1 + nearbyRobots × congestionWeight)
 *                       (crowded destinations become less desirable)
 *  - distanceBonus:     1 + min(dist, 20) × distanceWeight
 *                       (mild preference for spread)
 *
 * @returns array of scored candidates, unsorted. Empty if no 
 *          candidate passes the minDistance filter.
 */
export function scoreDestinations(
  candidates: Waypoint[],
  ctx: SelectionContext,
  options: Partial<SelectionOptions> = {}
): DestinationCandidate[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const scored: DestinationCandidate[] = [];

  const graph = ctx.graph ?? WAYPOINT_GRAPH;
  const startNode = graph[ctx.startWaypointId];

  for (const wp of candidates) {
    if (wp.id === ctx.startWaypointId) continue;

    const dist = Math.hypot(
      wp.x - ctx.startX,
      wp.z - ctx.startZ
    );
    if (dist < ctx.minDistance) continue;

    // Pheromone on the direct segment (if adjacent)
    let ph = 0;
    if (startNode && startNode.neighbors.includes(wp.id)) {
      ph = pheromoneMap.get(ctx.startWaypointId, wp.id);
    }

    // Congestion count
    let nearby = 0;
    for (const r of ctx.robots) {
      if (r.id === ctx.selfId) continue;
      const d = Math.hypot(
        r.position.x - wp.x,
        r.position.z - wp.z
      );
      if (d < opts.congestionRadius) nearby++;
    }
    const congestionPenalty =
      1 / (1 + nearby * opts.congestionWeight);

    // Distance preference
    const distanceBonus =
      1 + Math.min(dist, 20) * opts.distanceWeight;

    // Final score
    const pheromoneBoost = 1 + ph * opts.pheromoneWeight;

    // Maynard-Cross imitation: prefer waypoints where other robots 
    // recently succeeded
    const imitationBoost =
      1 + peerMemory.weight(wp.id) * opts.imitationWeight;

    // Diversity floor: penalize waypoints that are already 
    // destinations of other robots (excluding claimed filtering 
    // done upstream — this catches softer overlap)
    let peersTargeting = 0;
    for (const r of ctx.robots) {
      if (r.id === ctx.selfId) continue;
      if (r.destination === wp.id) peersTargeting++;
    }
    const diversityPenalty =
      1 / (1 + peersTargeting * opts.peerDestinationPenalty);

    const score =
      pheromoneBoost *
      congestionPenalty *
      distanceBonus *
      imitationBoost *
      diversityPenalty;

    scored.push({ waypoint: wp, score });
  }

  return scored;
}

/**
 * Pick a destination from candidates, weighted by their scores. 
 * Preserves exploration — a candidate with a very low score can 
 * still be picked, just rarely.
 *
 * Returns null if no candidate passes the minDistance filter.
 */
export function pickWeightedDestination(
  candidates: Waypoint[],
  ctx: SelectionContext,
  options: Partial<SelectionOptions> = {}
): Waypoint | null {
  const scored = scoreDestinations(candidates, ctx, options);
  if (scored.length === 0) return null;

  const total = scored.reduce((acc, c) => acc + c.score, 0);
  if (total <= 0) {
    // Degenerate scores — fall back to uniform random
    const randomPick = scored[Math.floor(Math.random() * scored.length)];
    return randomPick ? randomPick.waypoint : null;
  }

  let r = Math.random() * total;
  for (const c of scored) {
    r -= c.score;
    if (r <= 0) return c.waypoint;
  }
  const lastPick = scored[scored.length - 1];
  return lastPick ? lastPick.waypoint : null;
}
