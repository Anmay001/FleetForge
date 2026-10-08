import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/**
 * robots — current state snapshot of every AMR.
 * One row per robot. Updated frequently (every snapshot interval).
 */
export const robots = sqliteTable(
  'robots',
  {
    id: text('id').primaryKey(),
    numericId: text('numeric_id').notNull(),
    color: text('color').notNull(),
    battery: integer('battery').notNull().default(100),
    status: text('status').notNull().default('IDLE'),
    positionX: real('position_x').notNull().default(0),
    positionZ: real('position_z').notNull().default(0),
    targetX: real('target_x').notNull().default(0),
    targetZ: real('target_z').notNull().default(0),
    speed: real('speed').notNull().default(0),
    distanceTravelled: real('distance_travelled').notNull().default(0),
    payload: text('payload'),
    currentTask: text('current_task'),
    destination: text('destination').notNull().default('IDLE'),
    isEmergencyStopped: integer('is_emergency_stopped', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    statusIdx: index('robots_status_idx').on(table.status),
    updatedIdx: index('robots_updated_idx').on(table.updatedAt),
  })
);

/**
 * tasks — warehouse pick-and-drop tasks.
 * Created by operators or the auto-generator. Progress through
 * statuses: QUEUED → MOVING_TO_PICKUP → DROPPING → COMPLETED.
 */
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    boxId: text('box_id').notNull(),
    pickupNode: text('pickup_node').notNull(),
    dropLocation: text('drop_location').notNull(),
    assignedRobotId: text('assigned_robot_id').notNull(),
    status: text('status').notNull().default('QUEUED'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    statusIdx: index('tasks_status_idx').on(table.status),
    robotIdx: index('tasks_robot_idx').on(table.assignedRobotId),
    createdIdx: index('tasks_created_idx').on(table.createdAt),
  })
);

/**
 * events — append-only log of every simulation state change.
 * High volume; prune to last N via config.EVENT_LOG_LIMIT.
 */
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    robotId: text('robot_id').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    robotIdx: index('events_robot_idx').on(table.robotId),
    createdIdx: index('events_created_idx').on(table.createdAt),
    typeIdx: index('events_type_idx').on(table.type),
  })
);

/**
 * Type helpers — inferred row types for use in repositories.
 */
export type RobotRow = typeof robots.$inferSelect;
export type RobotInsert = typeof robots.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type EventInsert = typeof events.$inferInsert;