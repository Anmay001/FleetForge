import type { FastifyInstance } from 'fastify';
import type { ApiResponse, AMR } from '@fleetforge/shared';
import { robotsRepo } from '../repositories/index.js';
import {
  FleetQueryParams,
  RobotIdParam,
  SnapshotBody,
} from '../schemas/api.schemas.js';
import {
  parseBody,
  parseParams,
  parseQuery,
} from '../plugins/validate.js';
import { zodToOpenApi } from '../plugins/openapi.js';

interface FleetListResponse {
  robots: AMR[];
  total: number;
}

interface RobotDetailResponse {
  robot: AMR;
}

interface SnapshotResponse {
  upserted: number;
  total: number;
}

export async function registerFleetRoutes(
  app: FastifyInstance
): Promise<void> {
  /**
   * GET /api/fleet
   * Returns all robots, optionally filtered by ?ids=AMR-01,AMR-02
   */
  app.get<{
    Querystring: unknown;
    Reply: ApiResponse<FleetListResponse>;
  }>('/api/fleet', {
    schema: {
      tags: ['fleet'],
      summary: 'List all robots',
      description: 'Returns every robot, optionally filtered by ids',
      querystring: {
        type: 'object',
        properties: {
          ids: {
            type: 'string',
            description: 'Comma-separated robot IDs (e.g. AMR-01,AMR-02)',
          },
        },
      },
    },
  }, async (request) => {
    const query = parseQuery(FleetQueryParams, request);

    const rows =
      query.ids && query.ids.length > 0
        ? robotsRepo.findRobotsByIds(query.ids)
        : robotsRepo.findAllRobots();

    const robots = rows.map(robotsRepo.rowToAMR);

    return {
      ok: true,
      data: {
        robots,
        total: robots.length,
      },
    };
  });

  /**
   * GET /api/fleet/:id
   * Returns a single robot or 404.
   */
  app.get<{
    Params: unknown;
    Reply: ApiResponse<RobotDetailResponse>;
  }>('/api/fleet/:id', {
    schema: {
      tags: ['fleet'],
      summary: 'Get a robot by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = parseParams(RobotIdParam, request);

    const row = robotsRepo.findRobotById(id);
    if (!row) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Robot ${id} not found`,
        },
      });
    }

    return {
      ok: true,
      data: { robot: robotsRepo.rowToAMR(row) },
    };
  });

  /**
   * POST /api/fleet/snapshot
   * Bulk upsert — the frontend pushes its full fleet state every N
   * seconds when running in server-sync mode.
   */
  app.post<{
    Body: unknown;
    Reply: ApiResponse<SnapshotResponse>;
  }>('/api/fleet/snapshot', {
    schema: {
      tags: ['fleet'],
      summary: 'Bulk upsert robot state',
      description: 'Frontend pushes full fleet snapshot on interval',
      body: zodToOpenApi(SnapshotBody),
    },
  }, async (request) => {
    const body = parseBody(SnapshotBody, request);

    const inserts = body.robots.map((snapshot) => ({
      id: snapshot.id,
      numericId: snapshot.numericId,
      color: snapshot.color,
      battery: snapshot.battery,
      status: snapshot.status,
      positionX: snapshot.positionX,
      positionZ: snapshot.positionZ,
      targetX: snapshot.targetX,
      targetZ: snapshot.targetZ,
      speed: snapshot.speed,
      distanceTravelled: snapshot.distanceTravelled,
      payload: snapshot.payload,
      currentTask: snapshot.currentTask,
      destination: snapshot.destination,
      isEmergencyStopped: snapshot.isEmergencyStopped,
    }));

    robotsRepo.bulkUpsertRobots(inserts);

    const total = robotsRepo.countRobots();

    return {
      ok: true,
      data: {
        upserted: inserts.length,
        total,
      },
    };
  });
}