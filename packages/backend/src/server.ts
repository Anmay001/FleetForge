import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { runMigrations, closeDb, isDbHealthy } from './db/index.js';

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

  // --- Health check ---
  app.get('/healthz', async () => {
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
      health: '/healthz',
      // More endpoints added in later batches
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

  // --- Global error handler ---
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error');
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      ok: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message:
          config.isProduction && statusCode === 500
            ? 'Internal server error'
            : error.message,
      },
    });
  });

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