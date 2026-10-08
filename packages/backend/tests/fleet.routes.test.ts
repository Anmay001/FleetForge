import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { robotsRepo } from '../src/repositories/index.js';
import { runMigrations } from '../src/db/index.js';
import type { AMR } from '@fleetforge/shared';

describe('Fleet routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Clean slate
    runMigrations();
    robotsRepo.deleteAllRobots();

    app = await buildServer();
    await app.ready();

    // Seed two robots for deterministic assertions
    const base: AMR = {
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
      robotsRepo.amrToInsert(base),
      robotsRepo.amrToInsert({
        ...base,
        id: 'AMR-02',
        numericId: '02',
        color: '#3b82f6',
        battery: 78,
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/fleet returns robots wrapped in envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fleet',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data.robots)).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/fleet?ids=AMR-01 returns single robot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fleet?ids=AMR-01',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.robots.length).toBe(1);
    expect(body.data.robots[0].id).toBe('AMR-01');
  });

  it('GET /api/fleet/:id returns a single robot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fleet/AMR-01',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.robot.id).toBe('AMR-01');
    expect(body.data.robot.battery).toBe(92);
  });

  it('GET /api/fleet/:id returns 404 for unknown robot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fleet/AMR-99',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/fleet/snapshot upserts robots', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/fleet/snapshot',
      payload: {
        robots: [
          {
            id: 'AMR-03',
            numericId: '03',
            color: '#a855f7',
            battery: 85,
            status: 'MOVING_TO_PICKUP',
            positionX: 6,
            positionZ: 2,
            targetX: 10,
            targetZ: 6,
            speed: 0.9,
            distanceTravelled: 12.5,
            payload: null,
            currentTask: 'TASK-001',
            destination: 'RACK-A2',
            isEmergencyStopped: false,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.upserted).toBe(1);

    // Verify persisted
    const row = robotsRepo.findRobotById('AMR-03');
    expect(row).toBeDefined();
    expect(row?.status).toBe('MOVING_TO_PICKUP');
  });

  it('POST /api/fleet/snapshot rejects invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/fleet/snapshot',
      payload: {
        robots: [
          {
            id: 'AMR-04',
            // missing required fields
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('POST /api/fleet/snapshot rejects battery > 100', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/fleet/snapshot',
      payload: {
        robots: [
          {
            id: 'AMR-05',
            numericId: '05',
            color: '#eab308',
            battery: 150,
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
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    // Fastify validation error details format
    expect(body.error.details).toBeDefined();
    expect(typeof body.error.details).toBe('object');
  });
});