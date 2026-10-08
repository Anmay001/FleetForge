import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import { config } from '../config.js';

/**
 * Convert a Zod schema to a JSON schema for OpenAPI. Strips the
 * "$schema" meta field since Fastify's swagger plugin manages it.
 */
export function zodToOpenApi(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export async function registerOpenApi(
  app: FastifyInstance
): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'FleetForge API',
        description:
          'REST API for the FleetForge autonomous fleet coordination ' +
          'dashboard. All responses use the ApiResponse<T> envelope.',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Local development',
        },
      ],
      tags: [
        { name: 'health', description: 'Service health' },
        { name: 'fleet', description: 'Robot fleet state' },
        { name: 'tasks', description: 'Task queue' },
        { name: 'events', description: 'Event log' },
        { name: 'commands', description: 'Operator commands' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: false,
    },
    staticCSP: true,
  });
}