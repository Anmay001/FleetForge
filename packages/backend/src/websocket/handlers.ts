import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import {
  type ClientMessage,
  type WsTopic,
  isClientMessage,
  isWsTopic,
} from '@fleetforge/shared';
import { wsHub } from './hub.js';
import { config } from '../config.js';

/**
 * Called by Fastify when a client connects to /ws.
 */
export function handleConnection(
  socket: WebSocket,
  request: FastifyRequest
): void {
  const client = wsHub.addClient(socket);

  request.log.info(
    { clientId: client.id, ip: request.ip },
    'WebSocket client connected'
  );

  // Welcome message
  wsHub.sendTo(client.id, {
    type: 'welcome',
    clientId: client.id,
    serverTime: Date.now(),
    version: '1.0.0',
  });

  // --- Message handling ---
  socket.on('message', (raw: Buffer | string) => {
    let parsed: unknown;
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      parsed = JSON.parse(text);
    } catch {
      wsHub.sendTo(client.id, {
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Message is not valid JSON',
      });
      return;
    }

    if (!isClientMessage(parsed)) {
      wsHub.sendTo(client.id, {
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: 'Unknown or malformed message type',
      });
      return;
    }

    handleClientMessage(client.id, parsed);
  });

  // --- Pong handling ---
  socket.on('pong', () => {
    wsHub.markAlive(client.id);
  });

  // --- Close handling ---
  socket.on('close', (code: number, reason: Buffer) => {
    request.log.info(
      {
        clientId: client.id,
        code,
        reason: reason.toString('utf8'),
      },
      'WebSocket client disconnected'
    );
    wsHub.removeClient(client.id);
  });

  // --- Error handling ---
  socket.on('error', (err: Error) => {
    request.log.warn(
      { clientId: client.id, err },
      'WebSocket error'
    );
  });
}

function handleClientMessage(clientId: string, msg: ClientMessage): void {
  switch (msg.type) {
    case 'ping': {
      wsHub.sendTo(clientId, {
        type: 'pong',
        timestamp: msg.timestamp,
        serverTime: Date.now(),
      });
      return;
    }

    case 'subscribe': {
      const validTopics = (msg.topics ?? []).filter(isWsTopic);
      const { added } = wsHub.setSubscriptions(
        clientId,
        validTopics as WsTopic[],
        msg.robotIds
      );
      wsHub.sendTo(clientId, {
        type: 'subscribed',
        topics: added,
      });
      return;
    }

    case 'unsubscribe': {
      const validTopics = (msg.topics ?? []).filter(isWsTopic);
      const removed = wsHub.removeSubscriptions(
        clientId,
        validTopics as WsTopic[]
      );
      wsHub.sendTo(clientId, {
        type: 'unsubscribed',
        topics: removed,
      });
      return;
    }
  }
}

/**
 * Start the heartbeat interval. Call once on server boot.
 * Returns a cleanup function.
 */
export function startHeartbeat(): () => void {
  const interval = setInterval(() => {
    const dead = wsHub.heartbeatSweep();
    for (const clientId of dead) {
      const client = wsHub.getClient(clientId);
      if (client) {
        try {
          client.socket.terminate();
        } catch {
          // ignore
        }
        wsHub.removeClient(clientId);
      }
    }
  }, config.snapshotIntervalMs);

  return () => clearInterval(interval);
}