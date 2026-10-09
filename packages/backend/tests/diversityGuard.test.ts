import { describe, it, expect, beforeEach } from 'vitest';
import {
  scoreDestinations,
  peerMemory,
  pheromoneMap,
} from '@fleetforge/shared';
import type { AMR, Waypoint } from '@fleetforge/shared';

const WP_X: Waypoint = { id: 'RACK-A1', x: 4, z: 4 };
const WP_Y: Waypoint = { id: 'RACK-B1', x: 4, z: 12 };

function makeRobot(
  id: string,
  destination: string,
  x: number,
  z: number
): AMR {
  return {
    id,
    numericId: id.slice(-2),
    color: '#fff',
    battery: 100,
    status: 'IDLE',
    position: { x, y: 0, z },
    targetPosition: { x, y: 0, z },
    speed: 0,
    distanceTravelled: 0,
    payload: null,
    currentTask: null,
    destination,
    isEmergencyStopped: false,
  };
}

describe('diversity penalty', () => {
  beforeEach(() => {
    peerMemory.clear();
    pheromoneMap.clear();
  });

  it('scores are lower when other robots already target the waypoint', () => {
    const isolated = scoreDestinations([WP_X], {
      startWaypointId: 'CHARGE-01',
      startX: 2,
      startZ: 2,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
    });

    const crowded = scoreDestinations([WP_X], {
      startWaypointId: 'CHARGE-01',
      startX: 2,
      startZ: 2,
      robots: [
        makeRobot('AMR-02', 'RACK-A1', 10, 10),
        makeRobot('AMR-03', 'RACK-A1', 10, 10),
      ],
      selfId: 'AMR-01',
      minDistance: 0,
    });

    expect(crowded[0].score).toBeLessThan(isolated[0].score);
  });

  it('diversity penalty does not apply to self', () => {
    const noSelf = scoreDestinations([WP_X], {
      startWaypointId: 'CHARGE-01',
      startX: 2,
      startZ: 2,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
    });

    const withSelf = scoreDestinations([WP_X], {
      startWaypointId: 'CHARGE-01',
      startX: 2,
      startZ: 2,
      robots: [makeRobot('AMR-01', 'RACK-A1', 2, 2)],
      selfId: 'AMR-01',
      minDistance: 0,
    });

    expect(withSelf[0].score).toBeCloseTo(noSelf[0].score, 5);
  });
});

describe('imitation boost', () => {
  beforeEach(() => {
    peerMemory.clear();
    pheromoneMap.clear();
  });

  it('recent successes at a waypoint boost its score', () => {
    const before = scoreDestinations([WP_X], {
      startWaypointId: 'CHARGE-01',
      startX: 2,
      startZ: 2,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
    });

    for (let i = 0; i < 3; i++) {
      peerMemory.recordSuccess('RACK-A1');
    }

    const after = scoreDestinations([WP_X], {
      startWaypointId: 'CHARGE-01',
      startX: 2,
      startZ: 2,
      robots: [],
      selfId: 'AMR-01',
      minDistance: 0,
    });

    expect(after[0].score).toBeGreaterThan(before[0].score);
  });
});
