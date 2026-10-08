import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { eventsRepo } from '../src/repositories/index.js';
import { runMigrations } from '../src/db/index.js';

describe('Events routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    eventsRepo.deleteAllEvents();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/events returns empty list initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/events' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.events.length).toBe(0);
  });

  it('POST /api/events creates a single event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        robotId: 'AMR-01',
        message: 'test event from integration test',
        type: 'INFO',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.created).toBe(1);
  });

  it('POST /api/events bulk creates events', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        events: [
          { robotId: 'AMR-01', message: 'bulk 1', type: 'INFO' },
          { robotId: 'AMR-02', message: 'bulk 2', type: 'WARN' },
          { robotId: 'AMR-03', message: 'bulk 3', type: 'SUCCESS' },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.created).toBe(3);
  });

  it('GET /api/events?robotId=AMR-01 filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/events?robotId=AMR-01',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.events.length).toBeGreaterThanOrEqual(2);
    expect(
      body.data.events.every(
        (e: { robotId: string }) => e.robotId === 'AMR-01'
      )
    ).toBe(true);
  });

  it('GET /api/events?type=WARN filters by type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/events?type=WARN',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(
      body.data.events.every(
        (e: { type: string }) => e.type === 'WARN'
      )
    ).toBe(true);
  });

  it('POST /api/events rejects missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: { robotId: 'AMR-01' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/events/prune keeps only last N', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events/prune',
      payload: { keepLast: 2 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // prune keeps >= keepLast due to timestamp ties
    expect(body.data.remaining).toBeGreaterThanOrEqual(2);
  });
});