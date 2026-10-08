import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { robotsRepo, tasksRepo } from '../src/repositories/index.js';
import { runMigrations } from '../src/db/index.js';
import type { AMR, WarehouseTask } from '@fleetforge/shared';

describe('Tasks routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    robotsRepo.deleteAllRobots();
    tasksRepo.deleteAllTasks();

    app = await buildServer();
    await app.ready();

    const baseRobot: AMR = {
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
    robotsRepo.bulkUpsertRobots([
      robotsRepo.amrToInsert(baseRobot),
      robotsRepo.amrToInsert({
        ...baseRobot,
        id: 'AMR-02',
        numericId: '02',
        color: '#3b82f6',
      }),
    ]);

    // Seed one task for GET/PATCH tests
    const sample: WarehouseTask = {
      id: 'TASK-TEST-01',
      boxId: 'BOX-D201',
      pickupNode: 'RACK-A2',
      dropLocation: 'DROP-01',
      assignedRobotId: 'AMR-01',
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };
    tasksRepo.createTask(tasksRepo.warehouseTaskToInsert(sample));
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/tasks returns list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data.tasks)).toBe(true);
  });

  it('GET /api/tasks?status=QUEUED filters by status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=QUEUED',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.tasks.every((t: WarehouseTask) => t.status === 'QUEUED')).toBe(true);
  });

  it('GET /api/tasks/:id returns one', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks/TASK-TEST-01',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.task.id).toBe('TASK-TEST-01');
  });

  it('GET /api/tasks/:id returns 404 for unknown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks/TASK-NOPE',
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/tasks creates a new QUEUED task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        boxId: 'BOX-D999',
        pickupNode: 'RACK-B1',
        dropLocation: 'DROP-02',
        assignedRobotId: 'AMR-02',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.task.id).toMatch(/^TASK-/);
    expect(body.data.task.status).toBe('QUEUED');
    expect(body.data.task.boxId).toBe('BOX-D999');
  });

  it('POST /api/tasks rejects unknown robot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        boxId: 'BOX-X',
        pickupNode: 'RACK-A2',
        dropLocation: 'DROP-01',
        assignedRobotId: 'AMR-99',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/tasks rejects missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { boxId: 'BOX-Y' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('PATCH /api/tasks/:id updates status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/TASK-TEST-01',
      payload: { status: 'MOVING_TO_PICKUP' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.task.status).toBe('MOVING_TO_PICKUP');
  });

  it('PATCH /api/tasks/:id to COMPLETED sets completedAt', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/TASK-TEST-01',
      payload: { status: 'COMPLETED' },
    });
    expect(res.statusCode).toBe(200);
    const row = tasksRepo.findTaskById('TASK-TEST-01');
    expect(row?.completedAt).not.toBeNull();
  });

  it('POST /api/tasks/:id/assign reassigns to another robot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks/TASK-TEST-01/assign',
      payload: { robotId: 'AMR-02' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.task.assignedRobotId).toBe('AMR-02');
  });

  it('POST /api/tasks/:id/assign rejects unknown robot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks/TASK-TEST-01/assign',
      payload: { robotId: 'AMR-99' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});