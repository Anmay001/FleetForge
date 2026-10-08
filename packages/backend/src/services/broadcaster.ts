import type {
  EventPayload,
  FleetUpdatePayload,
  TaskUpdatePayload,
  CommandResultPayload,
  ServerMessage,
} from '@fleetforge/shared';
import type {
  EventRow,
  RobotRow,
  TaskRow,
} from '../db/schema.js';
import { wsHub } from '../websocket/hub.js';

/* ============================================================
 * Row -> wire payload mappers
 * ============================================================ */

function rowToFleetPayload(row: RobotRow): FleetUpdatePayload {
  return {
    id: row.id,
    numericId: row.numericId,
    color: row.color,
    battery: row.battery,
    status: row.status,
    positionX: row.positionX,
    positionZ: row.positionZ,
    targetX: row.targetX,
    targetZ: row.targetZ,
    speed: row.speed,
    distanceTravelled: row.distanceTravelled,
    payload: row.payload,
    currentTask: row.currentTask,
    destination: row.destination,
    isEmergencyStopped: row.isEmergencyStopped,
  };
}

function rowToTaskPayload(row: TaskRow): TaskUpdatePayload {
  return {
    id: row.id,
    boxId: row.boxId,
    pickupNode: row.pickupNode,
    dropLocation: row.dropLocation,
    assignedRobotId: row.assignedRobotId,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    completedAt: row.completedAt
      ? new Date(row.completedAt).toISOString()
      : null,
  };
}

function rowToEventPayload(row: EventRow): EventPayload {
  return {
    id: row.id,
    robotId: row.robotId,
    message: row.message,
    type: row.type as EventPayload['type'],
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/* ============================================================
 * Public broadcast helpers
 * ============================================================ */

/**
 * Broadcast a full fleet snapshot to 'fleet' subscribers.
 * Called periodically by the snapshot broadcaster.
 */
export function broadcastFleet(rows: RobotRow[]): number {
  const message: ServerMessage = {
    type: 'fleet:update',
    robots: rows.map(rowToFleetPayload),
    timestamp: Date.now(),
  };
  return wsHub.broadcast('fleet', message);
}

/**
 * Broadcast a single task update.
 */
export function broadcastTask(row: TaskRow): number {
  const message: ServerMessage = {
    type: 'task:update',
    task: rowToTaskPayload(row),
    timestamp: Date.now(),
  };
  return wsHub.broadcast('tasks', message);
}

/**
 * Broadcast a single event. Called from the event routes.
 */
export function broadcastEvent(row: EventRow): number {
  const message: ServerMessage = {
    type: 'event:new',
    event: rowToEventPayload(row),
    timestamp: Date.now(),
    // Robot-level filtering: only clients subscribed to this
    // specific robot receive it
  };
  // Third argument extracts the robot id for per-client filtering
  return wsHub.broadcast('events', message, (m) => {
    if (m.type === 'event:new') return m.event.robotId;
    return null;
  });
}

/**
 * Broadcast an event batch (used when multiple events are appended
 * at once, e.g. bulk import or fleet-wide commands).
 */
export function broadcastEvents(rows: EventRow[]): number {
  let total = 0;
  for (const row of rows) {
    total += broadcastEvent(row);
  }
  return total;
}

/**
 * Broadcast the result of a command dispatch.
 */
export function broadcastCommandResult(
  payload: CommandResultPayload
): number {
  const message: ServerMessage = {
    type: 'command:result',
    result: payload,
    timestamp: Date.now(),
  };
  return wsHub.broadcast('commands', message);
}