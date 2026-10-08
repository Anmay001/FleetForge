/**
 * Single source of truth for semantic colour in FleetForge.
 *
 * GREEN  → operational / active / healthy
 * BLUE   → navigation + informational
 * CYAN   → charging
 * AMBER  → warning / pending / obstacle-pending
 * RED    → error / critical / offline
 * SLATE  → idle
 *
 * Never use a tone for decoration. Components must read from here
 * instead of re-declaring status maps or battery thresholds.
 */

export type Tone = 'ok' | 'info' | 'charge' | 'warn' | 'danger' | 'idle';

/** Hex — three.js, inline styles, SVG. */
export const TONE_HEX: Record<Tone, string> = {
  ok: '#10b981',
  info: '#3b82f6',
  charge: '#06b6d4',
  warn: '#f59e0b',
  danger: '#ef4444',
  idle: '#94a3b8',
};

/** Tailwind background class — purge-safe (static strings only). */
export const TONE_BG: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  info: 'bg-blue-500',
  charge: 'bg-cyan-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  idle: 'bg-slate-400',
};

/** Tailwind text class — purge-safe (static strings only). */
export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-blue-600 dark:text-blue-400',
  charge: 'text-cyan-600 dark:text-cyan-400',
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  idle: 'text-slate-500 dark:text-slate-400',
};

/** Tailwind tinted-surface class — for badges and selected rows. */
export const TONE_SURFACE: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  charge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  idle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_TONE: Record<string, Tone> = {
  MOVING_TO_PICKUP: 'ok',
  CARRYING: 'ok',
  COMPLETED: 'ok',
  SUCCESS: 'ok',
  ALIGNING: 'info',
  PICKING_UP: 'info',
  DROPPING: 'info',
  GOING_TO_CHARGE: 'charge',
  WAITING: 'warn',
  WARN: 'warn',
  QUEUED: 'warn',
  OBSTACLE_DETECTED: 'danger',
  DANGER: 'danger',
  IDLE: 'idle',
};

export function toneOfStatus(status: string): Tone {
  return STATUS_TONE[status] ?? 'idle';
}

/** Robot states that are busy moving through the state machine. */
const ACTIVE_STATUSES = new Set([
  'MOVING_TO_PICKUP', 'CARRYING', 'ALIGNING', 'PICKING_UP', 'DROPPING',
]);

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Conditions an operator must notice immediately. */
export function needsAttention(status: string, isEmergencyStopped: boolean): boolean {
  return isEmergencyStopped ||
    status === 'OBSTACLE_DETECTED' ||
    status === 'WAITING';
}

/** Machine status → normal-case words an operator reads. */
export function statusLabel(status: string): string {
  const s = status.replace(/_/g, ' ').trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function toneOfBattery(percent: number): Tone {
  if (percent >= 60) return 'ok';
  if (percent >= 30) return 'warn';
  return 'danger';
}

export function batteryLabel(percent: number): string {
  if (percent >= 60) return 'Healthy';
  if (percent >= 30) return 'Low';
  return 'Critical';
}
