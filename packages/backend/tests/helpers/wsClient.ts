import WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from '@fleetforge/shared';

export interface TestWsClient {
  ws: WebSocket;
  /** Wait for the next message of a given type. */
  waitFor<T extends ServerMessage['type']>(
    type: T,
    timeoutMs?: number
  ): Promise<Extract<ServerMessage, { type: T }>>;
  /** Send a client message. */
  send(msg: ClientMessage): void;
  /** Close the socket and wait for it to be fully closed. */
  close(): Promise<void>;
  /** Collect all messages received so far (for assertions). */
  received: ServerMessage[];
}

/**
 * Connect to a WebSocket URL and return a helper with promise-based
 * receive helpers.
 */
export async function connectClient(url: string): Promise<TestWsClient> {
  const ws = new WebSocket(url);
  const received: ServerMessage[] = [];
  const waiters = new Map<
    string,
    Array<(msg: ServerMessage) => void>
  >();

  // ATTACH HANDLER IMMEDIATELY — before waiting for 'open'.
  // The server sends the welcome message the instant the socket
  // opens, so any delay in attaching this handler loses messages.
  ws.on('message', (raw: Buffer | string) => {
    let parsed: ServerMessage;
    try {
      const text =
        typeof raw === 'string' ? raw : raw.toString('utf8');
      parsed = JSON.parse(text) as ServerMessage;
    } catch {
      return;
    }
    received.push(parsed);

    const bucket = waiters.get(parsed.type);
    if (bucket && bucket.length > 0) {
      const resolve = bucket.shift()!;
      resolve(parsed);
    }
  });

  // Now wait for the connection to open
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('WebSocket connection timeout')),
      3000
    );
    ws.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  return {
    ws,
    received,
    send(msg: ClientMessage) {
      ws.send(JSON.stringify(msg));
    },
    waitFor<T extends ServerMessage['type']>(
      type: T,
      timeoutMs = 3000
    ): Promise<Extract<ServerMessage, { type: T }>> {
      // Check already-received messages first (this now works
      // because the handler is attached before open)
      const existing = received.find((m) => m.type === type);
      if (existing) {
        return Promise.resolve(
          existing as Extract<ServerMessage, { type: T }>
        );
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const bucket = waiters.get(type);
          if (bucket) {
            const idx = bucket.indexOf(handler);
            if (idx >= 0) bucket.splice(idx, 1);
          }
          reject(
            new Error(
              `Timeout (${timeoutMs}ms) waiting for message type "${type}"`
            )
          );
        }, timeoutMs);

        const handler = (msg: ServerMessage) => {
          clearTimeout(timer);
          resolve(msg as Extract<ServerMessage, { type: T }>);
        };

        const bucket = waiters.get(type) ?? [];
        bucket.push(handler);
        waiters.set(type, bucket);
      });
    },
    close() {
      return new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }
        ws.once('close', () => resolve());
        ws.close();
      });
    },
  };
}

/**
 * Small sleep helper for tests that need to wait for async effects.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}