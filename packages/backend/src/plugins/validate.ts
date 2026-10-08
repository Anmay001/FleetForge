import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';

/**
 * Validate and return the parsed request body.
 */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  request: FastifyRequest
): z.infer<T> {
  return schema.parse(request.body);
}

/**
 * Validate and return the parsed query string.
 */
export function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  request: FastifyRequest
): z.infer<T> {
  return schema.parse(request.query);
}

/**
 * Validate and return the parsed path params.
 */
export function parseParams<T extends z.ZodTypeAny>(
  schema: T,
  request: FastifyRequest
): z.infer<T> {
  return schema.parse(request.params);
}