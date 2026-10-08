import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ApiResponse, WarehouseTask } from '@fleetforge/shared';
import { tasksRepo, robotsRepo } from '../repositories/index.js';
import {
  CreateTaskBody,
  TaskIdParam,
  TaskQueryParams,
  UpdateTaskStatusBody,
} from '../schemas/api.schemas.js';
import { z } from 'zod';
import {
  parseBody,
  parseParams,
  parseQuery,
} from '../plugins/validate.js';
import { zodToOpenApi } from '../plugins/openapi.js';
import { broadcastTask } from '../services/broadcaster.js';

const AssignTaskBody = z.object({
  robotId: z.string().min(1).max(64),
});

interface TaskListResponse {
  tasks: WarehouseTask[];
  total: number;
}

interface TaskDetailResponse {
  task: WarehouseTask;
}

export async function registerTasksRoutes(
  app: FastifyInstance
): Promise<void> {
  /**
   * GET /api/tasks
   * Filters: ?status=QUEUED&robotId=AMR-01&since=<ms>&limit=100
   */
  app.get<{
    Querystring: unknown;
    Reply: ApiResponse<TaskListResponse>;
  }>('/api/tasks', {
    schema: {
      tags: ['tasks'],
      summary: 'List all tasks',
      description: 'Returns all tasks with optional filters',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['QUEUED', 'MOVING_TO_PICKUP', 'DROPPING', 'COMPLETED'] },
          robotId: { type: 'string' },
          since: { type: 'integer', description: 'Timestamp in ms' },
          limit: { type: 'integer', minimum: 1, maximum: 500 },
        },
      },
    },
  }, async (request) => {
    const query = parseQuery(TaskQueryParams, request);

    const rows = tasksRepo.findTasks({
      status: query.status,
      assignedRobotId: query.robotId,
      since: query.since,
      limit: query.limit,
    });

    const tasks = rows.map(tasksRepo.rowToWarehouseTask);

    return {
      ok: true,
      data: {
        tasks,
        total: tasks.length,
      },
    };
  });

  /**
   * GET /api/tasks/:id
   */
  app.get<{
    Params: unknown;
    Reply: ApiResponse<TaskDetailResponse>;
  }>('/api/tasks/:id', {
    schema: {
      tags: ['tasks'],
      summary: 'Get a task by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = parseParams(TaskIdParam, request);

    const row = tasksRepo.findTaskById(id);
    if (!row) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${id} not found`,
        },
      });
    }

    return {
      ok: true,
      data: { task: tasksRepo.rowToWarehouseTask(row) },
    };
  });

  /**
   * POST /api/tasks
   * Creates a new task. Auto-generates the ID.
   */
  app.post<{
    Body: unknown;
    Reply: ApiResponse<TaskDetailResponse>;
  }>('/api/tasks', {
    schema: {
      tags: ['tasks'],
      summary: 'Create a new task',
      body: zodToOpenApi(CreateTaskBody),
    },
  }, async (request, reply) => {
    const body = parseBody(CreateTaskBody, request);

    // Validate the assigned robot exists
    const robot = robotsRepo.findRobotById(body.assignedRobotId);
    if (!robot) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Robot ${body.assignedRobotId} does not exist`,
          details: { assignedRobotId: 'unknown robot' },
        },
      });
    }

    const id = `TASK-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const row = tasksRepo.createTask({
      id,
      boxId: body.boxId,
      pickupNode: body.pickupNode,
      dropLocation: body.dropLocation,
      assignedRobotId: body.assignedRobotId,
      status: 'QUEUED',
      createdAt: new Date(now),
    });

    broadcastTask(row);

    return reply.code(201).send({
      ok: true,
      data: { task: tasksRepo.rowToWarehouseTask(row) },
    });
  });

  /**
   * PATCH /api/tasks/:id
   * Update the task status. Sets completedAt when transitioning to
   * COMPLETED.
   */
  app.patch<{
    Params: unknown;
    Body: unknown;
    Reply: ApiResponse<TaskDetailResponse>;
  }>('/api/tasks/:id', {
    schema: {
      tags: ['tasks'],
      summary: 'Update task status',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: zodToOpenApi(UpdateTaskStatusBody),
    },
  }, async (request, reply) => {
    const { id } = parseParams(TaskIdParam, request);
    const body = parseBody(UpdateTaskStatusBody, request);

    const existing = tasksRepo.findTaskById(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${id} not found`,
        },
      });
    }

    const updated = tasksRepo.updateTaskStatus(id, body.status);
    if (!updated) {
      return reply.code(500).send({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Update failed',
        },
      });
    }

    broadcastTask(updated);

    return {
      ok: true,
      data: { task: tasksRepo.rowToWarehouseTask(updated) },
    };
  });

  /**
   * POST /api/tasks/:id/assign
   * Reassign the task to a different robot.
   */
  app.post<{
    Params: unknown;
    Body: unknown;
    Reply: ApiResponse<TaskDetailResponse>;
  }>('/api/tasks/:id/assign', {
    schema: {
      tags: ['tasks'],
      summary: 'Reassign task to another robot',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: zodToOpenApi(AssignTaskBody),
    },
  }, async (request, reply) => {
    const { id } = parseParams(TaskIdParam, request);
    const body = parseBody(AssignTaskBody, request);

    const task = tasksRepo.findTaskById(id);
    if (!task) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${id} not found`,
        },
      });
    }

    const robot = robotsRepo.findRobotById(body.robotId);
    if (!robot) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Robot ${body.robotId} does not exist`,
          details: { robotId: 'unknown robot' },
        },
      });
    }

    const updated = tasksRepo.assignTask(id, body.robotId);
    if (!updated) {
      return reply.code(500).send({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Assign failed',
        },
      });
    }

    broadcastTask(updated);

    return {
      ok: true,
      data: { task: tasksRepo.rowToWarehouseTask(updated) },
    };
  });
}

interface TaskListResponse {
  tasks: WarehouseTask[];
  total: number;
}

interface TaskDetailResponse {
  task: WarehouseTask;
}