import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiResponse, SimulationEvent } from '@fleetforge/shared';
import { eventsRepo } from '../repositories/index.js';
import { config } from '../config.js';
import {
  CreateEventBody,
  EventQueryParams,
} from '../schemas/api.schemas.js';
import { parseBody, parseQuery } from '../plugins/validate.js';
import { zodToOpenApi } from '../plugins/openapi.js';

const PruneEventsBody = z.object({
  keepLast: z.number().int().min(1).max(100_000).optional(),
});

const BulkEventsBody = z.object({
  events: z.array(CreateEventBody).min(1).max(1000),
});

interface EventListResponse {
  events: SimulationEvent[];
  total: number;
}

interface EventCreateResponse {
  created: number;
}

interface EventPruneResponse {
  pruned: number;
  remaining: number;
}

export async function registerEventsRoutes(
  app: FastifyInstance
): Promise<void> {
  /**
   * GET /api/events
   * Filters: ?robotId=&type=&since=&limit=
   */
  app.get<{
    Querystring: unknown;
    Reply: ApiResponse<EventListResponse>;
  }>('/api/events', {
    schema: {
      tags: ['events'],
      summary: 'List events',
      description: 'Returns events with optional filters',
      querystring: {
        type: 'object',
        properties: {
          robotId: { type: 'string' },
          type: { type: 'string', enum: ['INFO', 'WARN', 'DANGER', 'SUCCESS'] },
          since: { type: 'integer', description: 'Timestamp in ms' },
          limit: { type: 'integer', minimum: 1, maximum: 1000 },
        },
      },
    },
  }, async (request) => {
    const query = parseQuery(EventQueryParams, request);

    const rows = eventsRepo.findEvents({
      robotId: query.robotId,
      type: query.type,
      since: query.since,
      limit: query.limit,
    });

    const evts = rows.map(eventsRepo.rowToSimulationEvent);

    return {
      ok: true,
      data: {
        events: evts,
        total: evts.length,
      },
    };
  });

  /**
   * POST /api/events
   * Accepts either a single event or { events: [...] }.
   */
  app.post<{
    Body: unknown;
    Reply: ApiResponse<EventCreateResponse>;
  }>('/api/events', {
    schema: {
      tags: ['events'],
      summary: 'Create event(s)',
      description: 'Accepts a single event or bulk array',
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const isBulk = body && typeof body === 'object' && 'events' in body;

    if (isBulk) {
      const parsed = BulkEventsBody.parse(body);
      const inserts = parsed.events.map((e) =>
        eventsRepo.simulationEventToInsert({
          id: '0',
          robotId: e.robotId,
          message: e.message,
          type: e.type,
          timestamp: new Date().toISOString(),
        })
      );
      eventsRepo.appendEvents(inserts);
      return reply.code(201).send({
        ok: true,
        data: { created: inserts.length },
      });
    }

    const single = parseBody(CreateEventBody, request);
    eventsRepo.appendEvent(
      eventsRepo.simulationEventToInsert({
        id: '0',
        robotId: single.robotId,
        message: single.message,
        type: single.type,
        timestamp: new Date().toISOString(),
      })
    );
    return reply.code(201).send({
      ok: true,
      data: { created: 1 },
    });
  });

  /**
   * POST /api/events/prune
   * Keep only the last N events.
   */
  app.post<{
    Body: unknown;
    Reply: ApiResponse<EventPruneResponse>;
  }>('/api/events/prune', {
    schema: {
      tags: ['events'],
      summary: 'Prune event log',
      body: zodToOpenApi(PruneEventsBody),
    },
  }, async (request) => {
    const parsed = PruneEventsBody.parse(request.body ?? {});
    const keepLast = parsed.keepLast ?? config.eventLogLimit;
    const pruned = eventsRepo.pruneEvents(keepLast);
    const remaining = eventsRepo.countEvents();

    return {
      ok: true,
      data: { pruned, remaining },
    };
  });
}

interface EventListResponse {
  events: SimulationEvent[];
  total: number;
}

interface EventCreateResponse {
  created: number;
}

interface EventPruneResponse {
  pruned: number;
  remaining: number;
}