import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  robots,
  type RobotRow,
  type RobotInsert,
} from '../db/schema.js';
import type { AMR } from '@fleetforge/shared';

/**
 * Fetch all robots ordered by id.
 */
export function findAllRobots(): RobotRow[] {
  return db.select().from(robots).orderBy(robots.id).all();
}

/**
 * Fetch a single robot by primary key.
 */
export function findRobotById(id: string): RobotRow | undefined {
  return db.select().from(robots).where(eq(robots.id, id)).get();
}

/**
 * Upsert a single robot. Used by the snapshot service and on
 * command execution.
 */
export function upsertRobot(data: RobotInsert): RobotRow {
  return db
    .insert(robots)
    .values(data)
    .onConflictDoUpdate({
      target: robots.id,
      set: {
        numericId: data.numericId,
        color: data.color,
        battery: data.battery,
        status: data.status,
        positionX: data.positionX,
        positionZ: data.positionZ,
        targetX: data.targetX,
        targetZ: data.targetZ,
        speed: data.speed,
        distanceTravelled: data.distanceTravelled,
        payload: data.payload ?? null,
        currentTask: data.currentTask ?? null,
        destination: data.destination,
        isEmergencyStopped: data.isEmergencyStopped,
        updatedAt: new Date(),
      },
    })
    .returning()
    .get();
}

/**
 * Bulk upsert — the snapshot service writes all robots every cycle.
 * Wrapped in a transaction so all-or-nothing.
 */
export function bulkUpsertRobots(data: RobotInsert[]): void {
  if (data.length === 0) return;
  db.transaction((tx) => {
    for (const robot of data) {
      tx.insert(robots)
        .values(robot)
        .onConflictDoUpdate({
          target: robots.id,
          set: {
            numericId: robot.numericId,
            color: robot.color,
            battery: robot.battery,
            status: robot.status,
            positionX: robot.positionX,
            positionZ: robot.positionZ,
            targetX: robot.targetX,
            targetZ: robot.targetZ,
            speed: robot.speed,
            distanceTravelled: robot.distanceTravelled,
            payload: robot.payload ?? null,
            currentTask: robot.currentTask ?? null,
            destination: robot.destination,
            isEmergencyStopped: robot.isEmergencyStopped,
            updatedAt: new Date(),
          },
        })
        .run();
    }
  });
}

/**
 * Delete all robots. Used by the reset flow.
 */
export function deleteAllRobots(): void {
  db.delete(robots).run();
}

/**
 * Count robots.
 */
export function countRobots(): number {
  const result = db
    .select({ count: db.$count(robots) })
    .from(robots)
    .get();
  return result?.count ?? 0;
}

/**
 * Map a DB row to the shared AMR type — used when returning data
 * to the frontend.
 */
export function rowToAMR(row: RobotRow): AMR {
  return {
    id: row.id,
    numericId: row.numericId,
    color: row.color,
    battery: row.battery,
    status: row.status as AMR['status'],
    position: { x: row.positionX, y: 0, z: row.positionZ },
    targetPosition: { x: row.targetX, y: 0, z: row.targetZ },
    speed: row.speed,
    distanceTravelled: row.distanceTravelled,
    payload: row.payload,
    currentTask: row.currentTask,
    destination: row.destination,
    isEmergencyStopped: row.isEmergencyStopped,
  };
}

/**
 * Map a shared AMR to an insert row.
 */
export function amrToInsert(amr: AMR): RobotInsert {
  return {
    id: amr.id,
    numericId: amr.numericId,
    color: amr.color,
    battery: amr.battery,
    status: amr.status,
    positionX: amr.position.x,
    positionZ: amr.position.z,
    targetX: amr.targetPosition.x,
    targetZ: amr.targetPosition.z,
    speed: amr.speed,
    distanceTravelled: amr.distanceTravelled,
    payload: amr.payload,
    currentTask: amr.currentTask,
    destination: amr.destination,
    isEmergencyStopped: amr.isEmergencyStopped,
  };
}

/**
 * Fetch robots matching a set of IDs (used for selective sync).
 */
export function findRobotsByIds(ids: string[]): RobotRow[] {
  if (ids.length === 0) return [];
  return db.select().from(robots).where(inArray(robots.id, ids)).all();
}

// Placeholder reference so desc is considered "used" if not
// otherwise needed. Remove when a query actually needs desc().
void desc;