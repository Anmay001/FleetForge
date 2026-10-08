import fs from 'node:fs';
import path from 'node:path';
import { isDbHealthy, getSqliteClient } from '../db/index.js';
import {
  robotsRepo,
  tasksRepo,
  eventsRepo,
} from '../repositories/index.js';
import { config } from '../config.js';

export interface DbStats {
  healthy: boolean;
  path: string;
  sizeBytes: number;
  walSizeBytes: number;
  robots: number;
  tasks: number;
  events: number;
  lastEventAt: string | null;
}

/**
 * Snapshot of DB state for health endpoint. Cheap to compute — just
 * a few COUNT queries plus a stat() on the file.
 */
export function getDbStats(): DbStats {
  const rawPath = config.databaseUrl;
  const fullPath =
    rawPath === ':memory:' || rawPath.startsWith('file::memory:')
      ? ':memory:'
      : path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath);

  let sizeBytes = 0;
  let walSizeBytes = 0;
  if (fullPath !== ':memory:' && fs.existsSync(fullPath)) {
    try {
      sizeBytes = fs.statSync(fullPath).size;
    } catch {
      sizeBytes = 0;
    }
    const walPath = `${fullPath}-wal`;
    if (fs.existsSync(walPath)) {
      try {
        walSizeBytes = fs.statSync(walPath).size;
      } catch {
        walSizeBytes = 0;
      }
    }
  }

  let lastEventAt: string | null = null;
  try {
    const row = getSqliteClient()
      .prepare('SELECT created_at FROM events ORDER BY created_at DESC LIMIT 1')
      .get() as { created_at?: number } | undefined;
    if (row?.created_at) {
      lastEventAt = new Date(row.created_at).toISOString();
    }
  } catch {
    // ignore
  }

  return {
    healthy: isDbHealthy(),
    path: fullPath,
    sizeBytes,
    walSizeBytes,
    robots: safeCount(() => robotsRepo.countRobots()),
    tasks: safeCount(() => tasksRepo.countTasks()),
    events: safeCount(() => eventsRepo.countEvents()),
    lastEventAt,
  };
}

function safeCount(fn: () => number): number {
  try {
    return fn();
  } catch {
    return 0;
  }
}