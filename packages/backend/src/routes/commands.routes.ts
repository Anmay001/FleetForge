import type { FastifyInstance } from 'fastify';
import type { ApiResponse, CommandResult } from '@fleetforge/shared';
import { CommandBody } from '../schemas/api.schemas.js';
import { parseBody } from '../plugins/validate.js';
import { dispatchCommand } from '../services/commandService.js';
import { zodToOpenApi } from '../plugins/openapi.js';

export async function registerCommandsRoutes(
  app: FastifyInstance
): Promise<void> {
  /**
   * POST /api/commands
   * Body: { command: 'STOP'|'PAUSE'|..., robotId?: 'AMR-01' }
   * Returns CommandResult with accepted boolean.
   */
  app.post<{
    Body: unknown;
    Reply: ApiResponse<CommandResult>;
  }>('/api/commands', {
    schema: {
      tags: ['commands'],
      summary: 'Dispatch operator command',
      body: zodToOpenApi(CommandBody),
    },
  }, async (request, reply) => {
    const body = parseBody(CommandBody, request);
    const result = dispatchCommand(body);

    if (!result.accepted) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: result.message,
        },
      });
    }

    return {
      ok: true,
      data: result,
    };
  });
}