/**
 * Every REST response follows this envelope.
 * Success:  { ok: true,  data: T }
 * Failure:  { ok: false, error: { code, message, details? } }
 */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard error codes. Any code not in this list is treated as
 * unknown by the frontend.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST';

/**
 * Paginated list responses embed this alongside their data.
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Health check response shape.
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  env: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: 'ok' | 'failed';
  };
}

/**
 * Commands the operator can dispatch from the frontend.
 * Discriminated union — every command carries its own payload shape.
 */
export type RobotCommand =
  | { command: 'STOP'; robotId: string }
  | { command: 'PAUSE'; robotId: string }
  | { command: 'RESUME'; robotId: string }
  | { command: 'CHARGE'; robotId: string }
  | { command: 'REROUTE'; robotId: string }
  | { command: 'EMERGENCY_STOP' }
  | { command: 'CLEAR_EMERGENCY' };

/**
 * Response to a command dispatch.
 */
export interface CommandResult {
  accepted: boolean;
  robotId: string | null;
  command: string;
  message: string;
}