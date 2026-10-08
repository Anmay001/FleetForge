import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('Health endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz returns ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('fleetforge-backend');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET / returns service description', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe('FleetForge Backend');
    expect(body.endpoints.health).toBe('/healthz');
  });

  it('GET /nonexistent returns 404 JSON', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/nonexistent',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});