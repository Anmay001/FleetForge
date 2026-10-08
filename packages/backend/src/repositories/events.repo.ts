import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  events,
  type EventRow,
  type EventInsert,
} from '../db/schema.js';
import type { SimulationEvent } from '@fleetforge/shared';

export interface EventFilter {
  robotId?: string;
  type?: SimulationEvent['type'];
  since?: number;    // timestamp_ms
  limit?: number;
}

/**
 * Fetch events with optional filters, newest first.
 */
export function findEvents(filter: EventFilter = {}): EventRow[] {
  const conditions: SQL[] = [];

  if (filter.robotId !== undefined) {
    conditions.push(eq(events.robotId, filter.robotId));
  }
  if (filter.type !== undefined) {
    conditions.push(eq(events.type, filter.type));
  }
  if (filter.since !== undefined) {
    conditions.push(gte(events.createdAt, new Date(filter.since)));
  }

  const base = db.select().from(events);
  const withWhere =
    conditions.length > 0 ? base.where(and(...conditions)) : base;
  const ordered = withWhere.orderBy(desc(events.createdAt));
  const limited =
    filter.limit !== undefined
      ? ordered.limit(filter.limit)
      : ordered;

  return limited.all();
}

/**
 * Append a single event. Returns the inserted row.
 */
export function appendEvent(data: EventInsert): EventRow {
  return db.insert(events).values(data).returning().get();
}

/**
 * Bulk append — used by the snapshot service to batch events.
 */
export function appendEvents(data: EventInsert[]): void {
  if (data.length === 0) return;
  db.transaction((tx) => {
    for (const event of data) {
      tx.insert(events).values(event).run();
    }
  });
}

/**
 * Prune events older than the N most recent.
 * Used periodically to bound the table size.
 */
export function pruneEvents(keepLast: number): number {
  const oldestKept = db
    .select({ createdAt: events.createdAt })
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(1)
    .offset(keepLast - 1)
    .get();

  if (!oldestKept) return 0;

  const result = db
    .delete(events)
    .where(lt(events.createdAt, oldestKept.createdAt))
    .run();

  return result.changes ?? 0;
}

export function deleteAllEvents(): void {
  db.delete(events).run();
}

export function countEvents(): number {
  const result = db
    .select({ count: db.$count(events) })
    .from(events)
    .get();
  return result?.count ?? 0;
}

/**
 * Map a DB row to the shared SimulationEvent type.
 */
export function rowToSimulationEvent(row: EventRow): SimulationEvent {
  return {
    id: String(row.id),
    robotId: row.robotId,
    message: row.message,
    type: row.type as SimulationEvent['type'],
    timestamp: new Date(row.createdAt).toISOString(),
  };
}

/**
 * Map a shared SimulationEvent to an insert row.
 * Note: the numeric id is auto-generated, so we omit it.
 */
export function simulationEventToInsert(
  event: SimulationEvent
): EventInsert {
  return {
    robotId: event.robotId,
    message: event.message,
    type: event.type,
    createdAt: new Date(event.timestamp),
  };
}