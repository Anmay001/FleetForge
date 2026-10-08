import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { buildServer } from '../src/server.js';
import {
  robotsRepo,
  tasksRepo,
  eventsRepo,
} from '../src/repositories/index.js';
import { connectClient, sleep } from './helpers/wsClient.js';
import type { AMR } from '@fleetforge/shared';

describe('WebSocket integration', () => {
  let app: FastifyInstance;
  let port: number;
  let wsUrl: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as AddressInfo;
    port = address.port;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    robotsRepo.deleteAllRobots();
    tasksRepo.deleteAllTasks();
    eventsRepo.deleteAllEvents();

    // Seed one robot so cross-repo checks pass
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
      destination: 'IDLE',
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

  it('sends a welcome message on connect', async () => {
    const client = await connectClient(wsUrl);
    const welcome = await client.waitFor('welcome');
    expect(welcome.clientId).toMatch(/^client-/);
    expect(welcome.version).toBe('1.0.0');
    await client.close();
  });

  it('acknowledges subscriptions', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    client.send({ type: 'subscribe', topics: ['fleet', 'events'] });
    const sub = await client.waitFor('subscribed');
    expect(sub.topics).toContain('fleet');
    expect(sub.topics).toContain('events');
    await client.close();
  });

  it('responds to ping with pong', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    const sentAt = Date.now();
    client.send({ type: 'ping', timestamp: sentAt });
    const pong = await client.waitFor('pong');
    expect(pong.timestamp).toBe(sentAt);
    await client.close();
  });

  it('broadcasts event:new to subscribed clients', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    client.send({ type: 'subscribe', topics: ['events'] });
    await client.waitFor('subscribed');

    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        robotId: 'AMR-01',
        message: 'integration test event',
        type: 'INFO',
      },
    });
    expect(res.statusCode).toBe(201);

    const msg = await client.waitFor('event:new');
    expect(msg.event.robotId).toBe('AMR-01');
    expect(msg.event.message).toBe('integration test event');
    await client.close();
  });

  it('broadcasts task:update when a task is created', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    client.send({ type: 'subscribe', topics: ['tasks'] });
    await client.waitFor('subscribed');

    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        boxId: 'BOX-WS-01',
        pickupNode: 'RACK-A2',
        dropLocation: 'DROP-01',
        assignedRobotId: 'AMR-01',
      },
    });
    expect(res.statusCode).toBe(201);

    const msg = await client.waitFor('task:update');
    expect(msg.task.boxId).toBe('BOX-WS-01');
    expect(msg.task.status).toBe('QUEUED');
    await client.close();
  });

  it('broadcasts command:result and fleet:update on command', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    client.send({
      type: 'subscribe',
      topics: ['commands', 'fleet'],
    });
    await client.waitFor('subscribed');

    const res = await app.inject({
      method: 'POST',
      url: '/api/commands',
      payload: { command: 'CHARGE', robotId: 'AMR-01' },
    });
    expect(res.statusCode).toBe(200);

    const cmdResult = await client.waitFor('command:result');
    expect(cmdResult.result.accepted).toBe(true);
    expect(cmdResult.result.robotId).toBe('AMR-01');

    const fleetUpdate = await client.waitFor('fleet:update');
    expect(fleetUpdate.robots.length).toBeGreaterThanOrEqual(2);
    const updated = fleetUpdate.robots.find((r) => r.id === 'AMR-01');
    expect(updated?.status).toBe('GOING_TO_CHARGE');
    await client.close();
  });

  it('respects robotFilter on event subscription', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    client.send({
      type: 'subscribe',
      topics: ['events'],
      robotIds: ['AMR-02'],
    });
    await client.waitFor('subscribed');

    // Fire event for AMR-01 — should NOT be received
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        robotId: 'AMR-01',
        message: 'should be filtered out',
        type: 'INFO',
      },
    });

    // Give the socket a moment
    await sleep(150);
    const eventsForAmr01 = client.received.filter(
      (m) => m.type === 'event:new' && m.event.robotId === 'AMR-01'
    );
    expect(eventsForAmr01.length).toBe(0);

    // Now fire event for AMR-02 — should be received
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        robotId: 'AMR-02',
        message: 'should arrive',
        type: 'INFO',
      },
    });

    const msg = await client.waitFor('event:new');
    expect(msg.event.robotId).toBe('AMR-02');
    await client.close();
  });

  it('unsubscribe stops further deliveries', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');
    client.send({ type: 'subscribe', topics: ['events'] });
    await client.waitFor('subscribed');

    client.send({ type: 'unsubscribe', topics: ['events'] });
    const unsub = await client.waitFor('unsubscribed');
    expect(unsub.topics).toContain('events');

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        robotId: 'AMR-01',
        message: 'after unsubscribe',
        type: 'INFO',
      },
    });

    await sleep(150);
    const received = client.received.filter(
      (m) => m.type === 'event:new'
    );
    expect(received.length).toBe(0);
    await client.close();
  });

  it('delivers broadcasts to multiple clients', async () => {
    const c1 = await connectClient(wsUrl);
    const c2 = await connectClient(wsUrl);
    await Promise.all([c1.waitFor('welcome'), c2.waitFor('welcome')]);

    c1.send({ type: 'subscribe', topics: ['events'] });
    c2.send({ type: 'subscribe', topics: ['events'] });
    await Promise.all([c1.waitFor('subscribed'), c2.waitFor('subscribed')]);

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        robotId: 'AMR-01',
        message: 'multi-client broadcast',
        type: 'INFO',
      },
    });

    const [m1, m2] = await Promise.all([
      c1.waitFor('event:new'),
      c2.waitFor('event:new'),
    ]);
    expect(m1.event.message).toBe('multi-client broadcast');
    expect(m2.event.message).toBe('multi-client broadcast');

    await Promise.all([c1.close(), c2.close()]);
  });

  it('handles malformed JSON gracefully', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');

    client.ws.send('this is not json');
    const err = await client.waitFor('error');
    expect(err.code).toBe('INVALID_JSON');
    await client.close();
  });

  it('rejects unknown message types', async () => {
    const client = await connectClient(wsUrl);
    await client.waitFor('welcome');

    client.ws.send(JSON.stringify({ type: 'not_real' }));
    const err = await client.waitFor('error');
    expect(err.code).toBe('INVALID_MESSAGE');
    await client.close();
  });
});