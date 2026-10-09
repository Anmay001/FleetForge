import { describe, it, expect, beforeEach } from 'vitest';
import {
  scoreDestinations,
  pickWeightedDestination,
  pheromoneMap,
} from '@fleetforge/shared';
import type { AMR, Waypoint, GraphNode } from '@fleetforge/shared';

// Mock waypoints — a small 3×1 line for deterministic tests
const WP_A: Waypoint = { id: 'A', x: 0, z: 0 };
const WP_B: Waypoint = { id: 'B', x: 4, z: 0 };
const WP_C: Waypoint = { id: 'C', x: 8, z: 0 };
const ALL_WPS = [WP_A, WP_B, WP_C];

// Mock graph connecting A <-> B <-> C
const MOCK_GRAPH: Record<string, GraphNode> = {
  A: { id: 'A', x: 0, z: 0, neighbors: ['B'] },
  B: { id: 'B', x: 4, z: 0, neighbors: ['A', 'C'] },
  C: { id: 'C', x: 8, z: 0, neighbors: ['B'] },
};

function makeRobot(
  id: string,
  x: number,
  z: number
): AMR {
  return {
    id,
    numericId: id.slice(-2),
    color: '#ffffff',
    battery: 100,
    status: 'IDLE',
    position: { x, y: 0, z },
    targetPosition: { x, y: 0, z },
    speed: 0,
    distanceTravelled: 0,
    payload: null,
    currentTask: null,
    destination: 'IDLE',
    isEmergencyStopped: false,
  };
}

describe('destinationSelector scoring', () => {
  beforeEach(() => {
    pheromoneMap.clear();
  });

  it('excludes the start waypoint from scoring', () => {
    const scored = scoreDestinations(ALL_WPS, {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });
    expect(scored.find((s) => s.waypoint.id === 'A')).toBeUndefined();
  });

  it('excludes candidates below minDistance', () => {
    const scored = scoreDestinations(ALL_WPS, {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 5,
      graph: MOCK_GRAPH,
    });
    // B at distance 4 excluded, C at distance 8 included
    expect(scored.find((s) => s.waypoint.id === 'B')).toBeUndefined();
    expect(scored.find((s) => s.waypoint.id === 'C')).toBeDefined();
  });

  it('congestion penalty reduces score for crowded waypoints', () => {
    const empty = scoreDestinations([WP_C], {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });

    const crowded = scoreDestinations([WP_C], {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [
        makeRobot('AMR-02', 8, 0.5),
        makeRobot('AMR-03', 8, -0.5),
        makeRobot('AMR-04', 7.5, 0),
      ],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });

    expect(crowded[0].score).toBeLessThan(empty[0].score);
  });

  it('farther destinations score higher than nearer ones (with equal congestion)', () => {
    const scored = scoreDestinations([WP_B, WP_C], {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });
    const b = scored.find((s) => s.waypoint.id === 'B')!;
    const c = scored.find((s) => s.waypoint.id === 'C')!;
    expect(c.score).toBeGreaterThan(b.score);
  });

  it('adjacent high-pheromone segments boost score', () => {
    // Deposit heavily on A→B
    for (let i = 0; i < 5; i++) {
      pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    }

    const scored = scoreDestinations([WP_B, WP_C], {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });

    const b = scored.find((s) => s.waypoint.id === 'B')!;
    const c = scored.find((s) => s.waypoint.id === 'C')!;
    // B is adjacent to A and has pheromone; C is not adjacent
    expect(b.score).toBeGreaterThan(1.5);
  });

  it('pickWeightedDestination returns null for empty candidates', () => {
    const picked = pickWeightedDestination([], {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });
    expect(picked).toBeNull();
  });

  it('pickWeightedDestination returns null when all candidates filtered out', () => {
    const picked = pickWeightedDestination([WP_A], {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });
    // Only candidate is the start waypoint → filtered out
    expect(picked).toBeNull();
  });

  it('pickWeightedDestination returns a valid waypoint', () => {
    const picked = pickWeightedDestination(ALL_WPS, {
      startWaypointId: 'A',
      startX: 0,
      startZ: 0,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
      graph: MOCK_GRAPH,
    });
    expect(picked).not.toBeNull();
    expect(['B', 'C']).toContain(picked!.id);
  });

  it('pickWeightedDestination distributes according to scores over many trials', () => {
    // Heavy pheromone on A→B pulls picks toward B
    for (let i = 0; i < 10; i++) {
      pheromoneMap.depositOutcome('A', 'B', 'CARRYING');
    }

    const picks: Record<string, number> = { B: 0, C: 0 };
    for (let i = 0; i < 500; i++) {
      const w = pickWeightedDestination(ALL_WPS, {
        startWaypointId: 'A',
        startX: 0,
        startZ: 0,
        robots: [],
        selfId: 'AMR-01',
        minDistance: 0,
        graph: MOCK_GRAPH,
      });
      if (w) picks[w.id]++;
    }

    // B should win the majority due to pheromone boost
    expect(picks.B).toBeGreaterThan(picks.C);
  });
});
