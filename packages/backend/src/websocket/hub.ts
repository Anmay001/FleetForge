import type { WebSocket } from 'ws';
import type {
  ServerMessage,
  WsTopic,
} from '@fleetforge/shared';
import { VALID_TOPICS } from '@fleetforge/shared';

interface Client {
  id: string;
  socket: WebSocket;
  topics: Set<WsTopic>;
  robotFilter: Set<string> | null;  // null = all robots
  connectedAt: number;
  lastPongAt: number;
  alive: boolean;
}

class WebSocketHub {
  private clients = new Map<string, Client>();
  private counter = 0;

  addClient(socket: WebSocket): Client {
    this.counter += 1;
    const id = `client-${this.counter}-${Date.now().toString(36)}`;
    const client: Client = {
      id,
      socket,
      topics: new Set(),
      robotFilter: null,
      connectedAt: Date.now(),
      lastPongAt: Date.now(),
      alive: true,
    };
    this.clients.set(id, client);
    return client;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  getClient(id: string): Client | undefined {
    return this.clients.get(id);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientsSnapshot(): Array<{
    id: string;
    topics: string[];
    connectedAt: number;
    alive: boolean;
  }> {
    return Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      topics: Array.from(c.topics),
      connectedAt: c.connectedAt,
      alive: c.alive,
    }));
  }

  /** Update a client's subscriptions. */
  setSubscriptions(
    clientId: string,
    topics: WsTopic[],
    robotIds?: string[]
  ): { added: WsTopic[]; robotFilter: Set<string> | null } {
    const client = this.clients.get(clientId);
    if (!client) return { added: [], robotFilter: null };

    const added: WsTopic[] = [];
    for (const topic of topics) {
      if (VALID_TOPICS.includes(topic) && !client.topics.has(topic)) {
        client.topics.add(topic);
        added.push(topic);
      }
    }
    if (robotIds && robotIds.length > 0) {
      client.robotFilter = new Set(robotIds);
    }
    return { added, robotFilter: client.robotFilter };
  }

  /** Remove subscriptions. */
  removeSubscriptions(clientId: string, topics: WsTopic[]): WsTopic[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const removed: WsTopic[] = [];
    for (const topic of topics) {
      if (client.topics.delete(topic)) {
        removed.push(topic);
      }
    }
    return removed;
  }

  /** Send a message to a single client. */
  sendTo(clientId: string, message: ServerMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    if (client.socket.readyState !== 1 /* OPEN */) return false;
    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast a message to every client subscribed to a topic.
   * If robotFilter is provided on the message and the client has a
   * robot filter set, only robots in both sets are sent.
   */
  broadcast(
    topic: WsTopic,
    message: ServerMessage,
    robotIdExtractor?: (msg: ServerMessage) => string | null
  ): number {
    let delivered = 0;
    const extract = robotIdExtractor ?? (() => null);
    const robotId = extract(message);

    for (const client of this.clients.values()) {
      if (!client.topics.has(topic)) continue;
      if (client.socket.readyState !== 1) continue;

      // Robot-level filtering
      if (robotId && client.robotFilter && !client.robotFilter.has(robotId)) {
        continue;
      }

      try {
        client.socket.send(JSON.stringify(message));
        delivered += 1;
      } catch {
        // socket died — cleanup happens on close event
      }
    }
    return delivered;
  }

  /** Mark a client as alive (called on pong receive). */
  markAlive(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.alive = true;
      client.lastPongAt = Date.now();
    }
  }

  /**
   * Heartbeat sweep — call periodically. Returns IDs of clients
   * that failed to respond to the last ping.
   */
  heartbeatSweep(): string[] {
    const dead: string[] = [];
    for (const client of this.clients.values()) {
      if (!client.alive) {
        dead.push(client.id);
        continue;
      }
      client.alive = false;
      // Ping at the WS protocol level — client responds with pong
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client.socket as any).ping?.();
      } catch {
        dead.push(client.id);
      }
    }
    return dead;
  }

  /** Close all connections (used during shutdown). */
  closeAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.socket.close(1001, 'Server shutting down');
      } catch {
        // already closed
      }
    }
    this.clients.clear();
  }
}

export const wsHub = new WebSocketHub();