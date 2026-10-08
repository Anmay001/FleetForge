import { and, desc, eq, gte, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  tasks,
  type TaskRow,
  type TaskInsert,
} from '../db/schema.js';
import type { WarehouseTask } from '@fleetforge/shared';

export interface TaskFilter {
  status?: WarehouseTask['status'];
  assignedRobotId?: string;
  since?: number;   // timestamp_ms
  limit?: number;
}

/**
 * Fetch tasks with optional filters, newest first.
 */
export function findTasks(filter: TaskFilter = {}): TaskRow[] {
  const conditions: SQL[] = [];

  if (filter.status !== undefined) {
    conditions.push(eq(tasks.status, filter.status));
  }
  if (filter.assignedRobotId !== undefined) {
    conditions.push(
      eq(tasks.assignedRobotId, filter.assignedRobotId)
    );
  }
  if (filter.since !== undefined) {
    conditions.push(gte(tasks.createdAt, new Date(filter.since)));
  }

  const base = db.select().from(tasks);
  const withWhere =
    conditions.length > 0 ? base.where(and(...conditions)) : base;
  const ordered = withWhere.orderBy(desc(tasks.createdAt));
  const limited =
    filter.limit !== undefined
      ? ordered.limit(filter.limit)
      : ordered;

  return limited.all();
}

export function findTaskById(id: string): TaskRow | undefined {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

/**
 * Create a new task. Throws if the ID already exists.
 */
export function createTask(data: TaskInsert): TaskRow {
  return db.insert(tasks).values(data).returning().get();
}

/**
 * Update task status. Also sets completedAt when transitioning to
 * COMPLETED.
 */
export function updateTaskStatus(
  id: string,
  status: WarehouseTask['status']
): TaskRow | undefined {
  const completedAt =
    status === 'COMPLETED' ? new Date() : null;

  return db
    .update(tasks)
    .set({ status, completedAt })
    .where(eq(tasks.id, id))
    .returning()
    .get();
}

/**
 * Assign a robot to a task (or reassign).
 */
export function assignTask(
  id: string,
  robotId: string
): TaskRow | undefined {
  return db
    .update(tasks)
    .set({ assignedRobotId: robotId })
    .where(eq(tasks.id, id))
    .returning()
    .get();
}

/**
 * Delete a task (used for cleanup or reset).
 */
export function deleteTask(id: string): void {
  db.delete(tasks).where(eq(tasks.id, id)).run();
}

export function deleteAllTasks(): void {
  db.delete(tasks).run();
}

/**
 * Count tasks matching a filter.
 */
export function countTasks(
  filter: Pick<TaskFilter, 'status'> = {}
): number {
  const base = db.select({ count: db.$count(tasks) }).from(tasks);
  if (filter.status !== undefined) {
    return (
      base.where(eq(tasks.status, filter.status)).get()?.count ?? 0
    );
  }
  return base.get()?.count ?? 0;
}

/**
 * Map a DB row to the shared WarehouseTask type.
 */
export function rowToWarehouseTask(row: TaskRow): WarehouseTask {
  return {
    id: row.id,
    boxId: row.boxId,
    pickupNode: row.pickupNode,
    dropLocation: row.dropLocation,
    assignedRobotId: row.assignedRobotId,
    status: row.status as WarehouseTask['status'],
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/**
 * Map a shared WarehouseTask to an insert row.
 */
export function warehouseTaskToInsert(
  task: WarehouseTask
): TaskInsert {
  return {
    id: task.id,
    boxId: task.boxId,
    pickupNode: task.pickupNode,
    dropLocation: task.dropLocation,
    assignedRobotId: task.assignedRobotId,
    status: task.status,
    createdAt: new Date(task.createdAt),
  };
}