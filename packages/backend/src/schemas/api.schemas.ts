import { z } from 'zod';

/* ============================================================
 * Common primitives
 * ============================================================ */

export const RobotIdParam = z.object({
  id: z.string().min(1).max(64),
});

export const TaskIdParam = z.object({
  id: z.string().min(1).max(64),
});

/* ============================================================
 * Query parameters
 * Query strings arrive as strings, so use z.coerce for numbers
 * and z.enum for constrained values.
 * ============================================================ */

const TaskStatusEnum = z.enum([
  'QUEUED',
  'MOVING_TO_PICKUP',
  'DROPPING',
  'COMPLETED',
]);

const RobotStatusEnum = z.enum([
  'IDLE',
  'MOVING_TO_PICKUP',
  'ALIGNING',
  'PICKING_UP',
  'CARRYING',
  'DROPPING',
  'GOING_TO_CHARGE',
  'OBSTACLE_DETECTED',
  'WAITING',
  'YIELDING',
]);

const EventTypeEnum = z.enum(['INFO', 'WARN', 'DANGER', 'SUCCESS']);

export const TaskQueryParams = z.object({
  status: TaskStatusEnum.optional(),
  robotId: z.string().min(1).max(64).optional(),
  since: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const EventQueryParams = z.object({
  robotId: z.string().min(1).max(64).optional(),
  type: EventTypeEnum.optional(),
  since: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export const FleetQueryParams = z.object({
  ids: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined
    ),
});

/* ============================================================
 * Request bodies
 * ============================================================ */

export const CreateTaskBody = z.object({
  boxId: z.string().min(1).max(64),
  pickupNode: z.string().min(1).max(64),
  dropLocation: z.string().min(1).max(64),
  assignedRobotId: z.string().min(1).max(64),
});

export const UpdateTaskStatusBody = z.object({
  status: TaskStatusEnum,
});

export const CreateEventBody = z.object({
  robotId: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
  type: EventTypeEnum,
});

/**
 * Bulk snapshot — frontend pushes its full fleet state every N
 * seconds when in server-sync mode.
 */
const RobotSnapshotSchema = z.object({
  id: z.string().min(1).max(64),
  numericId: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  battery: z.number().min(0).max(100),
  status: RobotStatusEnum,
  positionX: z.number(),
  positionZ: z.number(),
  targetX: z.number(),
  targetZ: z.number(),
  speed: z.number().min(0),
  distanceTravelled: z.number().min(0),
  payload: z.string().max(64).nullable(),
  currentTask: z.string().max(64).nullable(),
  destination: z.string().max(64),
  isEmergencyStopped: z.boolean(),
});

export const SnapshotBody = z.object({
  robots: z.array(RobotSnapshotSchema).max(50),
});

/* ============================================================
 * Commands — discriminated union
 * ============================================================ */

export const CommandBody = z.discriminatedUnion('command', [
  z.object({
    command: z.literal('STOP'),
    robotId: z.string().min(1).max(64),
  }),
  z.object({
    command: z.literal('PAUSE'),
    robotId: z.string().min(1).max(64),
  }),
  z.object({
    command: z.literal('RESUME'),
    robotId: z.string().min(1).max(64),
  }),
  z.object({
    command: z.literal('CHARGE'),
    robotId: z.string().min(1).max(64),
  }),
  z.object({
    command: z.literal('REROUTE'),
    robotId: z.string().min(1).max(64),
  }),
  z.object({
    command: z.literal('EMERGENCY_STOP'),
  }),
  z.object({
    command: z.literal('CLEAR_EMERGENCY'),
  }),
]);

/* ============================================================
 * Exported inferred types (for use in route handlers)
 * ============================================================ */

export type TaskQueryParamsT = z.infer<typeof TaskQueryParams>;
export type EventQueryParamsT = z.infer<typeof EventQueryParams>;
export type FleetQueryParamsT = z.infer<typeof FleetQueryParams>;
export type CreateTaskBodyT = z.infer<typeof CreateTaskBody>;
export type UpdateTaskStatusBodyT = z.infer<typeof UpdateTaskStatusBody>;
export type CreateEventBodyT = z.infer<typeof CreateEventBody>;
export type SnapshotBodyT = z.infer<typeof SnapshotBody>;
export type CommandBodyT = z.infer<typeof CommandBody>;