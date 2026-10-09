import type {
  ClientMessage,
  ServerMessage,
  WsTopic,
} from '@fleetforge/shared';

export type MessageHandler = (message: ServerMessage) => void;
export type StatusHandler = (
  status: 'connecting' | 'open' | 'closed' | 'reconnecting'
) => void;

export interface WsClientOptions {
  url: string;
  topics: WsTopic[];
  robotIds?: string[];
  onMessage: MessageHandler;
  onStatus?: StatusHandler;
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;
const BACKOFF_MULTIPLIER = 1.8;

export class WsClient {
  private url: string;
  private topics: WsTopic[];
  private robotIds: string[];
  private onMessage: MessageHandler;
  private onStatus?: StatusHandler;
  private socket: WebSocket | null = null;
  private backoff = INITIAL_BACKOFF_MS;
  private reconnectTimer: number | null = null;
  private manualClose = false;

  constructor(opts: WsClientOptions) {
    this.url = opts.url;
    this.topics = opts.topics;
    this.robotIds = opts.robotIds ?? [];
    this.onMessage = opts.onMessage;
    this.onStatus = opts.onStatus;
  }

  connect(): void {
    this.manualClose = false;
    this.open();
  }

  close(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close(1000, 'Client closing');
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  updateSubscriptions(
    topics: WsTopic[],
    robotIds?: string[]
  ): void {
    this.topics = topics;
    if (robotIds) this.robotIds = robotIds;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendSubscribe();
    }
  }

  send(msg: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.socket.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  private open(): void {
    this.manualClose = false;
    this.onStatus?.('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = ws;

    ws.onopen = () => {
      this.backoff = INITIAL_BACKOFF_MS;
      this.onStatus?.('open');
      // Subscribe after welcome arrives — the server accepts
      // subscribe messages any time, but sending before welcome
      // also works.
    };

    ws.onmessage = (event: MessageEvent) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      // On welcome, subscribe and start pinging
      if (parsed.type === 'welcome') {
        this.sendSubscribe();
      }

      this.onMessage(parsed);
    };

    ws.onerror = () => {
      // The close handler will fire next; don't do work here
    };

    ws.onclose = () => {
      this.socket = null;
      if (this.manualClose) {
        this.onStatus?.('closed');
        return;
      }
      this.onStatus?.('reconnecting');
      this.scheduleReconnect();
    };
  }

  private sendSubscribe(): void {
    this.send({
      type: 'subscribe',
      topics: this.topics,
      robotIds: this.robotIds.length > 0 ? this.robotIds : undefined,
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = this.backoff;
    this.backoff = Math.min(
      MAX_BACKOFF_MS,
      this.backoff * BACKOFF_MULTIPLIER
    );
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manualClose) this.open();
    }, delay);
  }
}

/**
 * Build the WebSocket URL from the API base. Backend at
 * http://localhost:4000 → ws://localhost:4000/ws
 */
export function buildWsUrl(apiBase: string): string {
  if (!apiBase) return '';
  return apiBase
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
    .replace(/\/$/, '') + '/ws';
}