export type RobotStatus =
  | 'IDLE' | 'MOVING_TO_PICKUP' | 'ALIGNING' | 'PICKING_UP'
  | 'CARRYING' | 'DROPPING' | 'GOING_TO_CHARGE'
  | 'OBSTACLE_DETECTED' | 'WAITING';

export interface AMR {
  id: string;
  numericId: string;
  battery: number;
  status: RobotStatus;
  position: { x: number; y: number; z: number };
  targetPosition: { x: number; y: number; z: number };
  speed: number;
  distanceTravelled: number;
  currentTask: string | null;
  destination: string;
  payload: string | null;
  isEmergencyStopped: boolean;
  color: string;
}

export interface WarehouseTask {
  id: string;
  boxId: string;
  pickupNode: string;
  dropLocation: string;
  assignedRobotId: string;
  status: 'QUEUED' | 'MOVING_TO_PICKUP' | 'DROPPING' | 'COMPLETED';
  createdAt: string;
}

export interface SimulationEvent {
  id: string;
  timestamp: string;
  robotId: string;
  message: string;
  type: 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS';
}

export interface WarehouseRack {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  shelves: number;
}

export interface Obstacle { id: string; x: number; z: number; radius: number; }
export interface Waypoint { id: string; x: number; z: number; }
export interface DropZone { id: string; x: number; z: number; width: number; depth: number; }
export interface ChargingPad { id: string; x: number; z: number; }
