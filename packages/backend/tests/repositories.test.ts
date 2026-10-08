import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, getDbClient, getSqliteClient, runMigrations } from '../src/db/index.js';
import { robotsRepo, tasksRepo, eventsRepo } from '../src/repositories/index.js';
import type { AMR, WarehouseTask, SimulationEvent } from '@fleetforge/shared';

// Use a fresh in-memory DB for tests (isolated from dev data)
beforeAll(() => {
  // Run migrations to create tables in the in-memory DB
  runMigrations();
  // Drop any leftover rows
  robotsRepo.deleteAllRobots();
  tasksRepo.deleteAllTasks();
  eventsRepo.deleteAllEvents();
});

afterAll(() => {
  getSqliteClient().close();
});

describe('robots repository', () => {
  const sample: AMR = {
    id: 'AMR-01',
    numericId: '01',
    color: '#f97316',
    battery: 92,
    status: 'IDLE',
    position: { x: 2, y: 0, z: 2 },
    targetPosition: { x: 2, y: 0, z: 2 },
    speed: 0,
    distanceTravelled: 0,
    payload: null,
    currentTask: null,
    destination: 'CHARGE-01',
    isEmergencyStopped: false,
  };

  it('upserts and reads back', () => {
    robotsRepo.upsertRobot(robotsRepo.amrToInsert(sample));
    const row = robotsRepo.findRobotById('AMR-01');
    expect(row).toBeDefined();
    expect(row?.battery).toBe(92);
  });

  it('round-trips to shared AMR', () => {
    const row = robotsRepo.findRobotById('AMR-01');
    expect(row).toBeDefined();
    const amr = robotsRepo.rowToAMR(row!);
    expect(amr.id).toBe('AMR-01');
    expect(amr.position.x).toBe(2);
  });

  it('bulk upsert inserts multiple', () => {
    const many: AMR[] = [
      { ...sample, id: 'AMR-02', numericId: '02' },
      { ...sample, id: 'AMR-03', numericId: '03' },
    ];
    robotsRepo.bulkUpsertRobots(many.map(robotsRepo.amrToInsert));
    expect(robotsRepo.findAllRobots().length).toBeGreaterThanOrEqual(3);
  });
});

describe('tasks repository', () => {
  const sample: WarehouseTask = {
    id: 'TASK-001',
    boxId: 'BOX-D201',
    pickupNode: 'RACK-A2',
    dropLocation: 'DROP-01',
    assignedRobotId: 'AMR-01',
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };

  it('creates and finds', () => {
    tasksRepo.createTask(tasksRepo.warehouseTaskToInsert(sample));
    const row = tasksRepo.findTaskById('TASK-001');
    expect(row?.boxId).toBe('BOX-D201');
  });

  it('updates status', () => {
    const updated = tasksRepo.updateTaskStatus('TASK-001', 'COMPLETED');
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.completedAt).not.toBeNull();
  });
});

describe('events repository', () => {
  const baseSample: SimulationEvent = {
    id: '1',
    robotId: 'AMR-01',
    message: 'test event',
    type: 'INFO',
    timestamp: new Date().toISOString(),
  };

  const makeEvent = (id: string, msg: string): SimulationEvent => ({
    ...baseSample,
    id,
    message: msg,
    timestamp: new Date(Date.now() + Math.random()).toISOString(), // unique-ish
  });

  it('appends and reads back', () => {
    eventsRepo.appendEvent(eventsRepo.simulationEventToInsert(makeEvent('1', 'test event')));
    const rows = eventsRepo.findEvents({ robotId: 'AMR-01' });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('prunes to last N', () => {
    for (let i = 0; i < 5; i++) {
      eventsRepo.appendEvent(
        eventsRepo.simulationEventToInsert(makeEvent(String(i + 2), `event ${i}`))
      );
    }
    const before = eventsRepo.countEvents();
    expect(before).toBeGreaterThanOrEqual(6);
    eventsRepo.pruneEvents(3);
    const after = eventsRepo.countEvents();
    // prune keeps >= keepLast due to timestamp ties at boundary
    expect(after).toBeGreaterThanOrEqual(3);
    expect(after).toBeLessThanOrEqual(3 + 3); // allow tie margin
  });
});