import {
  ChargingPad, DropZone, Obstacle, WarehouseRack, Waypoint,
} from '../types/fleet';

/**
 * Lane grid coordinates. AMRs may only travel along lines where
 * x ∈ LANES.x or z ∈ LANES.z.
 */
export const LANES = {
  x: [2, 6, 10, 14, 18],
  z: [2, 6, 10, 14, 18],
};

export const WAYPOINTS: Waypoint[] = [
  // Charging pads — top-left and bottom-left corners
  { id: 'CHARGE-01', x: 2,  z: 2  },
  { id: 'CHARGE-02', x: 2,  z: 18 },
  // Drop zones — top-right and bottom-right corners
  { id: 'DROP-01',   x: 18, z: 2  },
  { id: 'DROP-02',   x: 18, z: 18 },
  // Rack approach points — bottom-right corner of each rack cell
  { id: 'RACK-A1',   x: 6,  z: 6  },
  { id: 'RACK-A2',   x: 10, z: 6  },
  { id: 'RACK-A3',   x: 14, z: 6  },
  { id: 'RACK-A4',   x: 18, z: 6  },
  { id: 'RACK-B1',   x: 6,  z: 14 },
  { id: 'RACK-B2',   x: 10, z: 14 },
  { id: 'RACK-B3',   x: 14, z: 14 },
  { id: 'RACK-B4',   x: 18, z: 14 },
  // Center hub — useful for routing through the middle
  { id: 'HUB-C',     x: 10, z: 10 },
];

// Racks sit INSIDE grid cells (2 units clearance on all sides
// from lanes). Row A occupies the (2–6) z-band; Row B the (10–14)
// z-band. Each rack is 2×2.
export const RACKS: WarehouseRack[] = [
  { id: 'RACK-A1', x: 3,  z: 3,  width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-A2', x: 7,  z: 3,  width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-A3', x: 11, z: 3,  width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-A4', x: 15, z: 3,  width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-B1', x: 3,  z: 11, width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-B2', x: 7,  z: 11, width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-B3', x: 11, z: 11, width: 2, depth: 2, shelves: 4 },
  { id: 'RACK-B4', x: 15, z: 11, width: 2, depth: 2, shelves: 4 },
];

// Obstacles sit in cell interiors, off every lane.
export const OBSTACLES: Obstacle[] = [
  { id: 'OBS-01', x: 4,  z: 8,  radius: 0.6 },
  { id: 'OBS-02', x: 12, z: 8,  radius: 0.5 },
  { id: 'OBS-03', x: 8,  z: 16, radius: 0.7 },
  { id: 'OBS-04', x: 12, z: 16, radius: 0.5 },
];

export const CHARGING_PADS: ChargingPad[] = [
  { id: 'CHARGE-01', x: 2, z: 2  },
  { id: 'CHARGE-02', x: 2, z: 18 },
];

export const DROP_ZONES: DropZone[] = [
  { id: 'DROP-01', x: 17, z: 1,  width: 3, depth: 3 },
  { id: 'DROP-02', x: 17, z: 17, width: 3, depth: 3 },
];

/**
 * Helper: is a world coordinate exactly on a lane?
 * Tolerance 0.15 units.
 */
export function isOnLane(x: number, z: number): boolean {
  const TOL = 0.15;
  const onXLane = LANES.x.some((lx) => Math.abs(x - lx) < TOL);
  const onZLane = LANES.z.some((lz) => Math.abs(z - lz) < TOL);
  return onXLane || onZLane;
}

/**
 * Helper: snap a coordinate to the nearest lane intersection.
 */
export function snapToLaneIntersection(x: number, z: number): {
  x: number;
  z: number;
} {
  const nearestX = LANES.x.reduce(
    (best, lx) => (Math.abs(lx - x) < Math.abs(best - x) ? lx : best),
    LANES.x[0]
  );
  const nearestZ = LANES.z.reduce(
    (best, lz) => (Math.abs(lz - z) < Math.abs(best - z) ? lz : best),
    LANES.z[0]
  );
  return { x: nearestX, z: nearestZ };
}
