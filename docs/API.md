# FleetForge API

Base URL (local): `http://localhost:4000`

Interactive docs: `http://localhost:4000/api/docs`

## Response Envelope

Every response uses the same shape:

Success (HTTP 2xx):
```json
{ "ok": true, "data": { ... } }
```

Failure (HTTP 4xx/5xx):
```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message", "details": {} } }
```

### Standard Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request body/query/params failed schema validation |
| `NOT_FOUND` | 404 | Resource does not exist |
| `BAD_REQUEST` | 400 | Command rejected (e.g. unknown robot) |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Endpoints

### Health

#### `GET /healthz`

Returns service health and database connectivity.

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "service": "fleetforge-backend",
    "version": "1.0.0",
    "env": "development",
    "uptime": 123.45,
    "timestamp": "2026-10-08T10:00:00.000Z",
    "checks": { "database": "ok" }
  }
}
```

If database is unreachable, `status` becomes `degraded` and `checks.database` is `failed`.

---

### Fleet

#### `GET /api/fleet`

List all robots, optionally filtered by IDs.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `ids` | string | Comma-separated robot IDs (e.g. `AMR-01,AMR-02`) |

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "robots": [
      {
        "id": "AMR-01",
        "numericId": "01",
        "color": "#f97316",
        "battery": 92,
        "status": "IDLE",
        "position": { "x": 2, "y": 0, "z": 2 },
        "targetPosition": { "x": 2, "y": 0, "z": 2 },
        "speed": 0,
        "distanceTravelled": 0,
        "payload": null,
        "currentTask": null,
        "destination": "CHARGE-01",
        "isEmergencyStopped": false
      }
    ],
    "total": 1
  }
}
```

#### `GET /api/fleet/:id`

Get a single robot by ID.

**Path Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | yes | Robot ID (e.g. `AMR-01`) |

**Response (200):** Same robot object as list, wrapped in `data.robot`.

**Response (404):** `NOT_FOUND` if robot doesn't exist.

#### `POST /api/fleet/snapshot`

Bulk upsert robot state. Frontend pushes full fleet snapshot on interval.

**Request Body:**
```json
{
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
      "destination": "IDLE",
      "isEmergencyStopped": false
    }
  ]
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": { "upserted": 5, "total": 5 }
}
```

---

### Tasks

#### `GET /api/tasks`

List tasks with optional filters.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `status` | string | `QUEUED` \| `MOVING_TO_PICKUP` \| `DROPPING` \| `COMPLETED` |
| `robotId` | string | Filter by assigned robot |
| `since` | integer | Timestamp in ms (ISO epoch) |
| `limit` | integer | Max results (1-500, default 100) |

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "tasks": [
      {
        "id": "TASK-001",
        "boxId": "BOX-D201",
        "pickupNode": "RACK-A2",
        "dropLocation": "DROP-01",
        "assignedRobotId": "AMR-01",
        "status": "QUEUED",
        "createdAt": "2026-10-08T10:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

#### `GET /api/tasks/:id`

Get a single task by ID.

**Response (404):** `NOT_FOUND` if task doesn't exist.

#### `POST /api/tasks`

Create a new QUEUED task. Auto-generates ID.

**Request Body:**
```json
{
  "boxId": "BOX-D999",
  "pickupNode": "RACK-A2",
  "dropLocation": "DROP-01",
  "assignedRobotId": "AMR-01"
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "task": {
      "id": "TASK-A1B2C3D4",
      "boxId": "BOX-D999",
      "pickupNode": "RACK-A2",
      "dropLocation": "DROP-01",
      "assignedRobotId": "AMR-01",
      "status": "QUEUED",
      "createdAt": "2026-10-08T10:30:00.000Z"
    }
  }
}
```

**Response (400):** `VALIDATION_ERROR` if robot doesn't exist or required fields missing.

#### `PATCH /api/tasks/:id`

Update task status. Sets `completedAt` when transitioning to `COMPLETED`.

**Request Body:**
```json
{ "status": "COMPLETED" }
```

**Valid statuses:** `QUEUED`, `MOVING_TO_PICKUP`, `DROPPING`, `COMPLETED`

#### `POST /api/tasks/:id/assign`

Reassign task to a different robot.

**Request Body:**
```json
{ "robotId": "AMR-02" }
```

**Response (400):** `VALIDATION_ERROR` if robot doesn't exist.

---

### Events

#### `GET /api/events`

List events with optional filters.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `robotId` | string | Filter by robot |
| `type` | string | `INFO` \| `WARN` \| `DANGER` \| `SUCCESS` |
| `since` | integer | Timestamp in ms |
| `limit` | integer | Max results (1-1000, default 200) |

#### `POST /api/events`

Create a single event or bulk insert.

**Single event:**
```json
{ "robotId": "AMR-01", "message": "test", "type": "INFO" }
```

**Bulk:**
```json
{ "events": [{ "robotId": "AMR-01", "message": "bulk 1", "type": "INFO" }, ...] }
```

**Response (201):**
```json
{ "ok": true, "data": { "created": 3 } }
```

#### `POST /api/events/prune`

Keep only the last N events.

**Request Body:**
```json
{ "keepLast": 100 }
```

Defaults to `config.eventLogLimit` (500).

---

### Commands

#### `POST /api/commands`

Dispatch an operator command to a robot (or fleet-wide).

**Request Body:**
```json
{ "command": "STOP", "robotId": "AMR-01" }
```

**Valid commands:**
| Command | robotId required | Effect |
|---------|------------------|--------|
| `STOP` | yes | Sets speed=0, status=IDLE, destination=IDLE |
| `PAUSE` | yes | Sets speed=0, status=WAITING |
| `RESUME` | yes | Sets status=IDLE, clears emergency stop |
| `CHARGE` | yes | Sets status=GOING_TO_CHARGE, destination=CHARGE-01 |
| `REROUTE` | yes | Sets destination=REROUTING, status=MOVING_TO_PICKUP |
| `EMERGENCY_STOP` | no | Stops ALL robots, sets emergency flag |
| `CLEAR_EMERGENCY` | no | Clears emergency on all robots, restores IDLE |

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "robotId": "AMR-01",
    "command": "STOP",
    "message": "Robot stopped"
  }
}
```

**Response (400):** `BAD_REQUEST` if robot not found, `VALIDATION_ERROR` for invalid command.

---

### OpenAPI / Swagger UI

Interactive documentation: `http://localhost:4000/api/docs`

---

## Database

- SQLite (better-sqlite3) + Drizzle ORM
- Tables: `robots`, `tasks`, `events`
- WAL mode enabled, foreign keys on
- Migrations in `packages/backend/drizzle/`
- Commands: `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:reset`, `db:reset:seed`

---

## Testing

```bash
cd packages/backend
npm test          # 52 tests (unit + integration + e2e)
npm run build     # TypeScript + Vite build
npm run dev       # Dev server with hot reload
```