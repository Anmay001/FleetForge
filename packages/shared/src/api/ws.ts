/**
 * Messages sent FROM the client TO the server.
 */
export type ClientMessage =
  | { type: 'subscribe'; topics: string[]; robotIds?: string[] }
  | { type: 'unsubscribe'; topics: string[] }
  | { type: 'ping'; timestamp: number };

/**
 * Messages sent FROM the server TO the client.
 */
export type ServerMessage =
  | { type: 'welcome'; clientId: string; serverTime: number; version: string }
  | { type: 'pong'; timestamp: number; serverTime: number }
  | { type: 'subscribed'; topics: string[] }
  | { type: 'unsubscribed'; topics: string[] }
  | { type: 'fleet:update'; robots: FleetUpdatePayload[]; timestamp: number }
  | { type: 'task:update'; task: TaskUpdatePayload; timestamp: number }
  | { type: 'event:new'; event: EventPayload; timestamp: number }
  | { type: 'command:result'; result: CommandResultPayload; timestamp: number }
  | { type: 'error'; code: string; message: string };

/**
 * Subscribable topics.
 */
export type WsTopic =
  | 'fleet'
  | 'tasks'
  | 'events'
  | 'commands';

export const VALID_TOPICS: readonly WsTopic[] = [
  'fleet',
  'tasks',
  'events',
  'commands',
] as const;

/* ============================================================
 * Payload shapes (mirror the REST types but wire-optimized)
 * ============================================================ */

export interface FleetUpdatePayload {
  id: string;
  numericId: string;
  color: string;
  battery: number;
  status: string;
  positionX: number;
  positionZ: number;
  targetX: number;
  targetZ: number;
  speed: number;
  distanceTravelled: number;
  payload: string | null;
  currentTask: string | null;
  destination: string;
  isEmergencyStopped: boolean;
}

export interface TaskUpdatePayload {
  id: string;
  boxId: string;
  pickupNode: string;
  dropLocation: string;
  assignedRobotId: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface EventPayload {
  id: number;
  robotId: string;
  message: string;
  type: 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS';
  createdAt: string;
}

export interface CommandResultPayload {
  accepted: boolean;
  robotId: string | null;
  command: string;
  message: string;
}

/* ============================================================
 * Type guards
 * ============================================================ */

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as { type?: unknown };
  return (
    v.type === 'subscribe' ||
    v.type === 'unsubscribe' ||
    v.type === 'ping'
  );
}

export function isWsTopic(value: unknown): value is WsTopic {
  return (
    typeof value === 'string' &&
    (VALID_TOPICS as readonly string[]).includes(value)
  );
}