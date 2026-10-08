# FleetForge WebSocket Protocol

Real-time streaming API for the FleetForge dashboard. Clients
subscribe to topics and receive updates as they happen.

## Connection

**URL**: `ws://localhost:4000/ws` (dev) — `wss://<host>/ws` (prod)

On connect, the server immediately sends a `welcome` message:

```json
{
  "type": "welcome",
  "clientId": "client-1-abc123",
  "serverTime": 1728391234567,
  "version": "1.0.0"
}
```

## Client → Server Messages

All messages are JSON objects with a `type` discriminator.

### Subscribe

```json
{ "type": "subscribe", "topics": ["fleet", "events", "tasks", "commands"], "robotIds": ["AMR-01"] }
```

- `topics` (required): array of topic names to subscribe to
- `robotIds` (optional): filter events to only these robot IDs

Valid topics: `fleet`, `tasks`, `events`, `commands`

### Unsubscribe

```json
{ "type": "unsubscribe", "topics": ["events"] }
```

### Ping

```json
{ "type": "ping", "timestamp": 1728391234567 }
```

Server responds with `pong` containing the same timestamp.

---

## Server → Client Messages

### Welcome

Sent immediately on connect.

```json
{
  "type": "welcome",
  "clientId": "client-1-abc123",
  "serverTime": 1728391234567,
  "version": "1.0.0"
}
```

### Subscribed / Unsubscribed

Confirmation of subscription changes.

```json
{ "type": "subscribed", "topics": ["fleet", "events"] }
{ "type": "unsubscribed", "topics": ["events"] }
```

### Fleet Update

Sent periodically (default 10s) and on state changes.

```json
{
  "type": "fleet:update",
  "robots": [
    {
      "id": "AMR-01",
      "numericId": "01",
      "color": "#f97316",
      "battery": 92,
      "status": "IDLE",
      "positionX": 2,
      "positionZ": 2,
      "targetX": 2,
      "targetZ": 2,
      "speed": 0,
      "distanceTravelled": 0,
      "payload": null,
      "currentTask": null,
      "destination": "CHARGE-01",
      "isEmergencyStopped": false
    }
  ],
  "timestamp": 1728391234567
}
```

### Task Update

```json
{
  "type": "task:update",
  "task": {
    "id": "TASK-A1B2C3D4",
    "boxId": "BOX-D201",
    "pickupNode": "RACK-A2",
    "dropLocation": "DROP-01",
    "assignedRobotId": "AMR-01",
    "status": "QUEUED",
    "createdAt": "2026-10-08T10:00:00.000Z",
    "completedAt": null
  },
  "timestamp": 1728391234567
}
```

### Event New

```json
{
  "type": "event:new",
  "event": {
    "id": 123,
    "robotId": "AMR-01",
    "message": "payload secured",
    "type": "SUCCESS",
    "createdAt": "2026-10-08T10:00:00.000Z"
  },
  "timestamp": 1728391234567
}
```

### Command Result

```json
{
  "type": "command:result",
  "result": {
    "accepted": true,
    "robotId": "AMR-01",
    "command": "CHARGE",
    "message": "Robot routed to charging station"
  },
  "timestamp": 1728391234567
}
```

### Error

```json
{
  "type": "error",
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": { "robots.0.battery": "must be <= 100" }
}
```

---

## Robot Filtering

When subscribing to `events`, clients may provide `robotIds`:

```json
{
  "type": "subscribe",
  "topics": ["events"],
  "robotIds": ["AMR-01", "AMR-02"]
}
```

Only events whose `robotId` matches one of the provided IDs will be
delivered. If `robotIds` is omitted or empty, all events are sent.

---

## Heartbeat

The server pings clients every `config.snapshotIntervalMs` (default
10s). Clients must respond with a WebSocket-level pong. Clients that
fail to respond are disconnected.

---

## Example: Full Session (Node.js)

```js
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:4000/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    topics: ['fleet', 'events', 'tasks', 'commands']
  }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  switch (msg.type) {
    case 'welcome':
      console.log('Connected as', msg.clientId);
      break;
    case 'subscribed':
      console.log('Subscribed to', msg.topics.join(', '));
      break;
    case 'fleet:update':
      console.log('Fleet:', msg.robots.length, 'robots');
      break;
    case 'event:new':
      console.log('Event:', msg.event.robotId, msg.event.message);
      break;
    case 'task:update':
      console.log('Task', msg.task.id, '→', msg.task.status);
      break;
    case 'command:result':
      console.log('Command:', msg.result.message);
      break;
    case 'error':
      console.error('Error:', msg.code, msg.message);
      break;
  }
});

ws.on('error', (e) => console.error('WS error:', e));
```

---

## REST Integration

WebSocket broadcasts are triggered by REST API operations:

| REST Endpoint | Triggers |
|---------------|----------|
| `POST /api/events` | `event:new` |
| `POST /api/events` (bulk) | multiple `event:new` |
| `POST /api/tasks` | `task:update` |
| `PATCH /api/tasks/:id` | `task:update` |
| `POST /api/tasks/:id/assign` | `task:update` |
| `POST /api/commands` | `command:result` + `fleet:update` |
| Fleet snapshot timer | `fleet:update` (every 10s) |

---

## Client Implementation Notes

- **Reconnect logic**: Implement exponential backoff on disconnect.
- **Idempotency**: The server may send duplicate messages; handle gracefully.
- **Backpressure**: If messages arrive faster than processed, consider
  buffering or requesting a lower frequency.
- **State sync**: On reconnect, fetch full state via REST (`/api/fleet`,
  `/api/tasks`, `/api/events`) then subscribe for deltas.