import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import {
  robotsRepo,
  tasksRepo,
  eventsRepo,
} from '../src/repositories/index.js';
import { runMigrations } from '../src/db/index.js';

describe('End-to-end workflow', () => {
  let app: FastifyInstance;
  let taskId: string;

  beforeAll(async () => {
    runMigrations();
    robotsRepo.deleteAllRobots();
    tasksRepo.deleteAllTasks();
    eventsRepo.deleteAllEvents();

    app = await buildServer();
    await app.ready();

    // Bootstrap 5 robots via snapshot (matches frontend sync)
    const res = await app.inject({
      method: 'POST',
      url: '/api/fleet/snapshot',
      payload: {
        robots: [1, 2, 3, 4, 5].map((n) => ({
          id: `AMR-0${n}`,
          numericId: `0${n}`,
          color: '#10b981',
          battery: 100 - n * 5,
          status: 'IDLE',
          positionX: 2,
          positionZ: 2,
          targetX: 2,
          targetZ: 2,
          speed: 0,
          distanceTravelled: 0,
          payload: null,
          currentTask: null,
          destination: 'IDLE',
          isEmergencyStopped: false,
        })),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.upserted).toBe(5);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. fleet starts with 5 robots', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fleet',
    });
    expect(res.json().data.total).toBe(5);
  });

  it('2. create a task for AMR-01', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        boxId: 'BOX-E2E-01',
        pickupNode: 'RACK-A2',
        dropLocation: 'DROP-01',
        assignedRobotId: 'AMR-01',
      },
    });
    expect(res.statusCode).toBe(201);
    taskId = res.json().data.task.id;
    expect(taskId).toMatch(/^TASK-/);
  });

  it('3. move the task through its lifecycle', async () => {
    const sequence = [
      'MOVING_TO_PICKUP',
      'DROPPING',
      'COMPLETED',
    ] as const;

    for (const status of sequence) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${taskId}`,
        payload: { status },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.task.status).toBe(status);
    }
  });

  it('4. task appears in COMPLETED filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=COMPLETED',
    });
    expect(res.statusCode).toBe(200);
    const tasks = res.json().data.tasks;
    expect(tasks.some((t: { id: string }) => t.id === taskId)).toBe(true);
  });

  it('5. emergency stop halts the fleet', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'EMERGENCY_STOP' },
    });
    expect(res.statusCode).toBe(200);

    const fleet = await app.inject({
      method: 'GET',
      url: '/api/fleet',
    });
    expect(
      fleet.json().data.robots.every(
        (r: { isEmergencyStopped: boolean }) => r.isEmergencyStopped
      )
    ).toBe(true);
  });

  it('6. DANGER events were logged for each robot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/events?type=DANGER',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.events.length).toBeGreaterThanOrEqual(5);
  });

  it('7. clear emergency restores fleet', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'CLEAR_EMERGENCY' },
    });

    const fleet = await app.inject({
      method: 'GET',
      url: '/api/fleet',
    });
    expect(
      fleet.json().data.robots.every(
        (r: { isEmergencyStopped: boolean }) => !r.isEmergencyStopped
      )
    ).toBe(true);
  });

  it('7. prune events to bound the log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events/prune',
      payload: { keepLast: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.remaining).toBe(5);
  });

  it('9. /api/docs is reachable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/docs',
    });
    // Swagger UI redirects to /api/docs/ or serves HTML
    expect([200, 301, 302]).toContain(res.statusCode);
  });
});