import type {
  ApiResponse,
  AMR,
  WarehouseTask,
  SimulationEvent,
  CommandResult,
  RobotCommand,
} from '@fleetforge/shared';

const API_BASE =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '';

export class ApiError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiError(
      'NETWORK_ERROR',
      `Failed to reach ${url}: ${(err as Error).message}`
    );
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      `Non-JSON response from ${url} (status ${res.status})`
    );
  }

  const envelope = parsed as ApiResponse<T>;
  if (!envelope || typeof envelope !== 'object') {
    throw new ApiError('INVALID_RESPONSE', 'Malformed response envelope');
  }
  if (!envelope.ok) {
    throw new ApiError(
      envelope.error.code,
      envelope.error.message,
      envelope.error.details
    );
  }
  return envelope.data;
}

/* ============================================================
 * Fleet
 * ============================================================ */

export interface FleetListData {
  robots: AMR[];
  total: number;
}

export async function fetchFleet(ids?: string[]): Promise<FleetListData> {
  const qs = ids && ids.length > 0 ? `?ids=${ids.join(',')}` : '';
  return request<FleetListData>(`/api/fleet${qs}`);
}

export interface SnapshotPayloadRobot {
  id: string;
  numericId: string;
  color: string;
  battery: number;
  status: string;
  positionX: number;
  positionZ: number;
  targetX: number;
  targetZ: number;
  speed: number;
  distanceTravelled: number;
  payload: string | null;
  currentTask: string | null;
  destination: string;
  isEmergencyStopped: boolean;
}

export interface SnapshotResponse {
  upserted: number;
  total: number;
}

export async function pushFleetSnapshot(
  robots: SnapshotPayloadRobot[]
): Promise<SnapshotResponse> {
  return request<SnapshotResponse>('/api/fleet/snapshot', {
    method: 'POST',
    body: JSON.stringify({ robots }),
  });
}

/* ============================================================
 * Tasks
 * ============================================================ */

export async function fetchTasks(
  filter?: {
    status?: string;
    robotId?: string;
    since?: number;
    limit?: number;
  }
): Promise<{ tasks: WarehouseTask[]; total: number }> {
  const params = new URLSearchParams();
  if (filter?.status) params.set('status', filter.status);
  if (filter?.robotId) params.set('robotId', filter.robotId);
  if (filter?.since) params.set('since', String(filter.since));
  if (filter?.limit) params.set('limit', String(filter.limit));
  const qs = params.toString();
  return request(`/api/tasks${qs ? `?${qs}` : ''}`);
}

export async function createTask(input: {
  boxId: string;
  pickupNode: string;
  dropLocation: string;
  assignedRobotId: string;
}): Promise<{ task: WarehouseTask }> {
  return request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTaskStatus(
  id: string,
  status: string
): Promise<{ task: WarehouseTask }> {
  return request(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/* ============================================================
 * Events
 * ============================================================ */

export async function fetchEvents(filter?: {
  robotId?: string;
  type?: string;
  since?: number;
  limit?: number;
}): Promise<{ events: SimulationEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (filter?.robotId) params.set('robotId', filter.robotId);
  if (filter?.type) params.set('type', filter.type);
  if (filter?.since) params.set('since', String(filter.since));
  if (filter?.limit) params.set('limit', String(filter.limit));
  const qs = params.toString();
  return request(`/api/events${qs ? `?${qs}` : ''}`);
}

export async function appendEvent(input: {
  robotId: string;
  message: string;
  type: 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS';
}): Promise<{ created: number }> {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function appendEventsBulk(
  events: Array<{
    robotId: string;
    message: string;
    type: 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS';
  }>
): Promise<{ created: number }> {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}

/* ============================================================
 * Commands
 * ============================================================ */

export async function dispatchCommand(
  command: RobotCommand
): Promise<CommandResult> {
  return request<CommandResult>('/api/commands', {
    method: 'POST',
    body: JSON.stringify(command),
  });
}

/* ============================================================
 * Health
 * ============================================================ */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  uptime: number;
  checks: { database: string; websocket?: string };
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/healthz');
}

/* ============================================================
 * Config helper
 * ============================================================ */

export function isServerModeEnabled(): boolean {
  return API_BASE.length > 0;
}

export function getApiBase(): string {
  return API_BASE;
}