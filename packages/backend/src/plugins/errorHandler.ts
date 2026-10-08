import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { config } from '../config.js';

interface FastifyError extends Error {
  statusCode?: number;
  code?: string;
  validation?: unknown;
}

/**
 * Extract the first N field errors from a ZodError into a flat
 * object for the API response.
 */
function formatZodIssues(
  error: ZodError
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!(path in out)) {
      out[path] = issue.message;
    }
  }
  return out;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (
      error: FastifyError,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      // --- Zod validation errors ---
      if (error instanceof ZodError) {
        request.log.info(
          { issues: error.issues },
          'Request validation failed'
        );
        return reply.code(400).send({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: formatZodIssues(error),
          },
        });
      }

      // --- Fastify built-in validation errors ---
      if (error.code === 'FST_ERR_VALIDATION') {
        request.log.info(
          { validation: error.validation },
          'Request validation failed'
        );
        return reply.code(400).send({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.validation,
          },
        });
      }

      // --- Fastify built-in errors (statusCode set) ---
      const statusCode = error.statusCode ?? 500;
      const code = error.code ?? 'INTERNAL_ERROR';

      if (statusCode >= 500) {
        request.log.error({ err: error }, 'Server error');
      } else {
        request.log.info(
          { err: error, statusCode },
          'Client error'
        );
      }

      return reply.code(statusCode).send({
        ok: false,
        error: {
          code,
          message:
            config.isProduction && statusCode === 500
              ? 'Internal server error'
              : error.message,
        },
      });
    }
  );
}