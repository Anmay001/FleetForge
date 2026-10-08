import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { runMigrations, closeDb, isDbHealthy } from './db/index.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerFleetRoutes } from './routes/fleet.routes.js';
import { registerTasksRoutes } from './routes/tasks.routes.js';
import { registerEventsRoutes } from './routes/events.routes.js';
import { registerCommandsRoutes } from './routes/commands.routes.js';
import type { HealthCheckResponse } from '@fleetforge/shared';

/**
 * Build the Fastify instance without starting it. Useful for tests
 * via `app.inject()` without binding a port.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
    disableRequestLogging: config.isProduction,
    trustProxy: true,
  });

  // --- Run migrations on boot ---
  runMigrations();

  // --- CORS ---
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // --- WebSocket plugin (no handlers registered yet) ---
  await app.register(websocket, {
    options: {
      maxPayload: 1_048_576, // 1 MB
    },
  });

  // --- OpenAPI ---
  await registerOpenApi(app);

  // --- Domain routes ---
  await registerFleetRoutes(app);
  await registerTasksRoutes(app);
  await registerEventsRoutes(app);
  await registerCommandsRoutes(app);

  // --- Health check ---
  app.get('/healthz', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded'] },
            service: { type: 'string' },
            version: { type: 'string' },
            env: { type: 'string' },
            uptime: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['ok', 'failed'] },
              },
            },
          },
        },
      },
    },
  }, async (): Promise<HealthCheckResponse> => {
    const dbHealthy = isDbHealthy();
    return {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'fleetforge-backend',
      version: '1.0.0',
      env: config.nodeEnv,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'failed',
      },
    };
  });

  // --- Root discovery endpoint ---
  app.get('/', async () => ({
    service: 'FleetForge Backend',
    description:
      'Autonomous Fleet Coordination API — see /healthz for status',
    endpoints: {
      docs: '/api/docs',
      health: '/healthz',
      fleet: {
        list: 'GET /api/fleet',
        detail: 'GET /api/fleet/:id',
        snapshot: 'POST /api/fleet/snapshot',
      },
      tasks: {
        list: 'GET /api/tasks',
        detail: 'GET /api/tasks/:id',
        create: 'POST /api/tasks',
        updateStatus: 'PATCH /api/tasks/:id',
        assign: 'POST /api/tasks/:id/assign',
      },
      events: {
        list: 'GET /api/events',
        append: 'POST /api/events',
        prune: 'POST /api/events/prune',
      },
      commands: {
        dispatch: 'POST /api/commands',
      },
    },
  }));

  // --- 404 handler ---
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // --- Global error handler (Zod-aware) ---
  registerErrorHandler(app);

  return app;
}

/**
 * Start the server with graceful shutdown.
 */
async function start(): Promise<void> {
  const app = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down gracefully');
    closeDb();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Only auto-start when this file is the entry point (not when
// imported by tests).
const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js');

if (isMain) {
  void start();
}