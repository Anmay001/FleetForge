import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { robotsRepo, eventsRepo } from '../src/repositories/index.js';
import { runMigrations } from '../src/db/index.js';
import type { AMR } from '@fleetforge/shared';

describe('Commands route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    robotsRepo.deleteAllRobots();
    eventsRepo.deleteAllEvents();

    app = await buildServer();
    await app.ready();

    const base: AMR = {
      id: 'AMR-01',
      numericId: '01',
      color: '#f97316',
      battery: 92,
      status: 'MOVING_TO_PICKUP',
      position: { x: 2, y: 0, z: 2 },
      targetPosition: { x: 10, y: 0, z: 10 },
      speed: 0.9,
      distanceTravelled: 5,
      payload: null,
      currentTask: 'TASK-001',
      destination: 'RACK-A2',
      isEmergencyStopped: false,
    };
    robotsRepo.bulkUpsertRobots([
      robotsRepo.amrToInsert(base),
      robotsRepo.amrToInsert({
        ...base,
        id: 'AMR-02',
        numericId: '02',
        color: '#3b82f6',
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/commands STOP halts a robot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'STOP', robotId: 'AMR-01' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.accepted).toBe(true);

    const robot = robotsRepo.findRobotById('AMR-01');
    expect(robot?.speed).toBe(0);
    expect(robot?.status).toBe('IDLE');
  });

  it('POST /api/commands PAUSE sets WAITING', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'PAUSE', robotId: 'AMR-02' },
    });
    expect(res.statusCode).toBe(200);
    const robot = robotsRepo.findRobotById('AMR-02');
    expect(robot?.status).toBe('WAITING');
    expect(robot?.speed).toBe(0);
  });

  it('POST /api/commands CHARGE routes to charger', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'CHARGE', robotId: 'AMR-01' },
    });
    expect(res.statusCode).toBe(200);
    const robot = robotsRepo.findRobotById('AMR-01');
    expect(robot?.status).toBe('GOING_TO_CHARGE');
    expect(robot?.destination).toBe('CHARGE-01');
  });

  it('POST /api/commands EMERGENCY_STOP affects all robots', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'EMERGENCY_STOP' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accepted).toBe(true);
    expect(body.data.robotId).toBeNull();

    const all = robotsRepo.findAllRobots();
    expect(all.every((r) => r.isEmergencyStopped)).toBe(true);
    expect(all.every((r) => r.speed === 0)).toBe(true);
  });

  it('POST /api/commands CLEAR_EMERGENCY restores robots', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'CLEAR_EMERGENCY' },
    });
    expect(res.statusCode).toBe(200);
    const all = robotsRepo.findAllRobots();
    expect(all.every((r) => !r.isEmergencyStopped)).toBe(true);
    expect(all.every((r) => r.status === 'IDLE')).toBe(true);
  });

  it('POST /api/commands unknown robot returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'STOP', robotId: 'AMR-99' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('POST /api/commands rejects invalid command', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'LAUNCH_MISSILE', robotId: 'AMR-01' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('commands are recorded as events', async () => {
    eventsRepo.deleteAllEvents();
    await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'STOP', robotId: 'AMR-01' },
    });
    const events = eventsRepo.findEvents({ robotId: 'AMR-01' });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].message).toContain('stopped by operator');
  });
});