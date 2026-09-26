import { useEffect, useRef } from 'react';
import { useFleetStore } from '../store/useFleetStore';
import { AMR } from '../types/fleet';
import {
  WAYPOINTS, CHARGING_PADS, DROP_ZONES,
} from '../data/warehouseLayout';
import { WAYPOINT_GRAPH, snapToWaypoint } from '../engine/waypointGraph';
import { planRoute, PlannerContext } from '../engine/routePlanner';
import { pheromoneMap } from '../engine/pheromoneMap';
import { routeRegistry } from '../engine/routeRegistry';

const WAYPOINT_MAP: Record<string, { x: number; z: number }> =
  Object.fromEntries(WAYPOINTS.map((w) => [w.id, { x: w.x, z: w.z }]));

// -------- Tuning --------
const ARRIVAL_TOL = 0.1;
const MAX_SPEED = 0.9;          // was 1.8 — halved for smoother feel
const ACCEL = 0.4;              // was 1.2 — gentler ramp-up
const DECEL = 0.8;              // was 1.5 — smoother stops
const COORD_TICK_MS = 200;      // 5 Hz decision loop
const WAIT_TIMEOUT_MS = 6000;   // force replan after 6s blocked
const REPLAN_COOLDOWN_MS = 1500;

// -------- Phase tracking --------
interface RobotPhase {
  phase:
    | 'IDLE' | 'MOVING' | 'WAITING' | 'ALIGNING'
    | 'PICKING_UP' | 'DROPPING' | 'CHARGING' | 'OBSTACLE';
  phaseStartedAt: number;
  currentWaypointId: string | null;
  nextWaypointId: string | null;
  path: string[] | null;
  destinationId: string | null;
  waitingSince: number;
  lastPlanAt: number;
  reachedTarget: boolean;
}

// -------- Planner context builder --------
function buildContext(selfId: string): PlannerContext {
  return {
    reservedSegments: routeRegistry.reservedSegments(selfId),
    occupiedWaypoints: routeRegistry.occupiedWaypoints(selfId),
    selfId,
  };
}

// -------- Destination picker --------
function pickDestination(robot: AMR, allRobots: AMR[]): string {
  if (robot.battery < 25) {
    let bestId = CHARGING_PADS[0].id;
    let bestDist = Infinity;
    for (const pad of CHARGING_PADS) {
      const d = Math.hypot(
        pad.x - robot.position.x, pad.z - robot.position.z
      );
      if (d < bestDist) { bestDist = d; bestId = pad.id; }
    }
    return bestId;
  }

  const claimed = new Set(
    allRobots
      .filter((r) => r.id !== robot.id && r.destination !== 'IDLE')
      .map((r) => r.destination)
  );
  const currentWp = snapToWaypoint(robot.position.x, robot.position.z);
  const candidates = WAYPOINTS.filter((w) => {
    if (w.id === currentWp) return false;
    if (claimed.has(w.id)) return false;
    return Math.hypot(
      w.x - robot.position.x, w.z - robot.position.z
    ) > 4;
  });
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }
  const relaxed = WAYPOINTS.filter(
    (w) => w.id !== currentWp && !claimed.has(w.id)
  );
  if (relaxed.length > 0) {
    return relaxed[Math.floor(Math.random() * relaxed.length)].id;
  }
  return WAYPOINTS[0].id;
}

// -------- Plan + lock + publish --------
function planAndReserve(
  robot: AMR,
  destId: string,
  phase: RobotPhase,
  nowMs: number
): boolean {
  const startId = snapToWaypoint(robot.position.x, robot.position.z);
  if (!startId || !WAYPOINT_GRAPH[destId]) return false;

  const ctx = buildContext(robot.id);
  const path = planRoute(startId, destId, ctx);
  if (!path || path.length < 2) return false;

  const nextId = path[1];
  if (!routeRegistry.lockWaypoint(nextId, robot.id)) return false;

  // Lock current position too
  routeRegistry.lockWaypoint(startId, robot.id);

  phase.path = path;
  phase.currentWaypointId = startId;
  phase.nextWaypointId = nextId;
  phase.destinationId = destId;
  phase.lastPlanAt = nowMs;
  phase.reachedTarget = false;
  phase.waitingSince = 0;

  routeRegistry.publish(robot.id, path, nextId);
  return true;
}

// -------- Advance along path after arrival at next waypoint --------
function advanceAlongPath(
  robot: AMR,
  phase: RobotPhase,
  nowMs: number
): 'continue' | 'arrived' | 'blocked' {
  if (!phase.nextWaypointId || !phase.path) return 'arrived';

  // Deposit pheromone on the segment just traversed
  if (phase.currentWaypointId && phase.nextWaypointId) {
    pheromoneMap.deposit(
      phase.currentWaypointId, phase.nextWaypointId
    );
  }

  // Release the waypoint we just left
  if (phase.currentWaypointId) {
    routeRegistry.releaseWaypoint(
      phase.currentWaypointId, robot.id
    );
  }

  // Advance: current becomes next, trim path
  phase.currentWaypointId = phase.nextWaypointId;
  const remaining = phase.path.slice(1);
  phase.path = remaining;
  phase.reachedTarget = false;

  // Are we done?
  if (remaining.length < 2) {
    phase.nextWaypointId = null;
    routeRegistry.unpublish(robot.id);
    return 'arrived';
  }

  // Try to lock the new next waypoint
  const newNext = remaining[1];
  if (!routeRegistry.lockWaypoint(newNext, robot.id)) {
    phase.nextWaypointId = null;
    phase.waitingSince = nowMs;
    return 'blocked';
  }

  phase.nextWaypointId = newNext;
  routeRegistry.publish(robot.id, remaining, newNext);
  return 'continue';
}

// -------- Coordinator (5 Hz) --------
function runCoordinator(
  robots: AMR[],
  phases: Map<string, RobotPhase>,
  nowMs: number
): void {
  routeRegistry.tick();
  pheromoneMap.decay(nowMs);

  const ordered = [...robots].sort((a, b) =>
    a.numericId.localeCompare(b.numericId)
  );

  for (const robot of ordered) {
    if (robot.isEmergencyStopped) continue;

    let phase = phases.get(robot.id);
    if (!phase) {
      const wpId = snapToWaypoint(
        robot.position.x, robot.position.z
      );
      phase = {
        phase: 'IDLE',
        phaseStartedAt: nowMs,
        currentWaypointId: wpId,
        nextWaypointId: null,
        path: null,
        destinationId: null,
        waitingSince: 0,
        lastPlanAt: 0,
        reachedTarget: false,
      };
      phases.set(robot.id, phase);
      // Lock initial waypoint
      if (wpId) routeRegistry.lockWaypoint(wpId, robot.id);
    }

    // ---------- IDLE ----------
    if (phase.phase === 'IDLE') {
      if (nowMs - phase.lastPlanAt < REPLAN_COOLDOWN_MS) continue;
      const destId = pickDestination(robot, robots);
      if (!planAndReserve(robot, destId, phase, nowMs)) continue;

      useFleetStore.getState().updateRobot(robot.id, {
        status: 'MOVING_TO_PICKUP',
        destination: destId,
        targetPosition: {
          x: WAYPOINT_MAP[destId].x,
          y: 0,
          z: WAYPOINT_MAP[destId].z,
        },
      });
      useFleetStore.getState().addEvent({
        robotId: robot.id,
        message: `${robot.id} routed to ${destId}`,
        type: 'INFO',
      });
      phase.phase = 'MOVING';
      phase.phaseStartedAt = nowMs;
      continue;
    }

    // ---------- MOVING ----------
    if (phase.phase === 'MOVING') {
      if (!phase.reachedTarget) continue;

      const result = advanceAlongPath(robot, phase, nowMs);
      if (result === 'continue') {
        useFleetStore.getState().updateRobot(robot.id, {
          status: robot.payload !== null
            ? 'CARRYING' : 'MOVING_TO_PICKUP',
        });
      } else if (result === 'arrived') {
        // Decide terminal phase
        const destId = phase.destinationId ?? '';
        const isCharger = CHARGING_PADS.some(
          (p) => p.id === destId
        );
        const isDrop = DROP_ZONES.some(
          (d) => destId === snapToWaypoint(d.x + 1, d.z + 1)
        );

        if (isCharger) {
          useFleetStore.getState().updateRobot(robot.id, {
            status: 'GOING_TO_CHARGE', speed: 0,
          });
          phase.phase = 'CHARGING';
        } else if (isDrop && robot.payload !== null) {
          useFleetStore.getState().updateRobot(robot.id, {
            status: 'DROPPING', speed: 0,
          });
          phase.phase = 'DROPPING';
        } else {
          useFleetStore.getState().updateRobot(robot.id, {
            status: 'ALIGNING', speed: 0,
          });
          phase.phase = 'ALIGNING';
        }
        phase.phaseStartedAt = nowMs;
      } else {
        // Blocked
        useFleetStore.getState().updateRobot(robot.id, {
          status: 'WAITING', speed: 0,
        });
        phase.phase = 'WAITING';
        phase.phaseStartedAt = nowMs;
        if (phase.waitingSince === 0) phase.waitingSince = nowMs;
      }
      continue;
    }

    // ---------- WAITING ----------
    if (phase.phase === 'WAITING') {
      if (phase.waitingSince === 0) phase.waitingSince = nowMs;
      const waited = nowMs - phase.waitingSince;

      // Try again to lock the next waypoint
      if (phase.path && phase.path.length >= 2) {
        const newNext = phase.path[1];
        if (routeRegistry.lockWaypoint(newNext, robot.id)) {
          phase.nextWaypointId = newNext;
          routeRegistry.publish(robot.id, phase.path, newNext);
          phase.waitingSince = 0;
          phase.phase = 'MOVING';
          phase.phaseStartedAt = nowMs;
          useFleetStore.getState().updateRobot(robot.id, {
            status: robot.payload !== null
              ? 'CARRYING' : 'MOVING_TO_PICKUP',
          });
          continue;
        }
      }

      // Hard timeout: abandon route, replan from scratch
      if (waited > WAIT_TIMEOUT_MS) {
        useFleetStore.getState().addEvent({
          robotId: robot.id,
          message: `${robot.id} rerouting — path blocked >6s`,
          type: 'WARN',
        });
        // Release everything we hold
        if (phase.currentWaypointId) {
          routeRegistry.releaseWaypoint(
            phase.currentWaypointId, robot.id
          );
        }
        routeRegistry.unpublish(robot.id);

        // Re-lock current position
        const wpId = snapToWaypoint(
          robot.position.x, robot.position.z
        );
        if (wpId) routeRegistry.lockWaypoint(wpId, robot.id);

        phase.phase = 'IDLE';
        phase.destinationId = null;
        phase.path = null;
        phase.nextWaypointId = null;
        phase.currentWaypointId = wpId;
        phase.waitingSince = 0;
        phase.lastPlanAt = 0;
        phase.phaseStartedAt = nowMs;
        useFleetStore.getState().updateRobot(robot.id, {
          status: 'IDLE', speed: 0, destination: 'IDLE',
        });
      }
      continue;
    }

    // ---------- ALIGNING ----------
    if (phase.phase === 'ALIGNING') {
      if (nowMs - phase.phaseStartedAt > 500) {
        useFleetStore.getState().updateRobot(robot.id, {
          status: 'PICKING_UP',
        });
        phase.phase = 'PICKING_UP';
        phase.phaseStartedAt = nowMs;
      }
      continue;
    }

    // ---------- PICKING_UP ----------
    if (phase.phase === 'PICKING_UP') {
      if (nowMs - phase.phaseStartedAt > 1000) {
        const payloadId =
          `BOX-D${200 + Math.floor(Math.random() * 100)}`;
        const drop = DROP_ZONES[
          Math.floor(Math.random() * DROP_ZONES.length)
        ];
        const targetX = drop.x + 1;
        const targetZ = drop.z + 1;
        const dropWp = snapToWaypoint(targetX, targetZ);

        if (dropWp && planAndReserve(robot, dropWp, phase, nowMs)) {
          useFleetStore.getState().updateRobot(robot.id, {
            status: 'CARRYING',
            payload: payloadId,
            destination: dropWp,
            currentTask:
              `TASK-${600 + Math.floor(Math.random() * 50)}`,
            targetPosition: {
              x: WAYPOINT_MAP[dropWp].x, y: 0,
              z: WAYPOINT_MAP[dropWp].z,
            },
          });
          useFleetStore.getState().addEvent({
            robotId: robot.id,
            message: `${robot.id} payload ${payloadId} secured`,
            type: 'SUCCESS',
          });
          phase.phase = 'MOVING';
          phase.phaseStartedAt = nowMs;
        }
      }
      continue;
    }

    // ---------- DROPPING ----------
    if (phase.phase === 'DROPPING') {
      if (nowMs - phase.phaseStartedAt > 800) {
        if (phase.currentWaypointId) {
          routeRegistry.releaseWaypoint(
            phase.currentWaypointId, robot.id
          );
        }
        useFleetStore.getState().updateRobot(robot.id, {
          status: 'IDLE',
          payload: null,
          currentTask: null,
          destination: 'IDLE',
        });
        useFleetStore.getState().addEvent({
          robotId: robot.id,
          message:
            `${robot.id} task completed at ${phase.destinationId}`,
          type: 'SUCCESS',
        });
        phase.phase = 'IDLE';
        phase.destinationId = null;
        phase.path = null;
        phase.nextWaypointId = null;
        phase.currentWaypointId = snapToWaypoint(
          robot.position.x, robot.position.z
        );
        phase.phaseStartedAt = nowMs;
        phase.lastPlanAt = 0;
      }
      continue;
    }

    // ---------- CHARGING ----------
    if (phase.phase === 'CHARGING') {
      const newBattery = Math.min(
        100, robot.battery + 0.5 * (COORD_TICK_MS / 1000)
      );
      if (newBattery >= 90) {
        if (phase.currentWaypointId) {
          routeRegistry.releaseWaypoint(
            phase.currentWaypointId, robot.id
          );
        }
        useFleetStore.getState().updateRobot(robot.id, {
          status: 'IDLE', battery: newBattery, destination: 'IDLE',
        });
        useFleetStore.getState().addEvent({
          robotId: robot.id,
          message:
            `${robot.id} charged to ${newBattery.toFixed(0)}%`,
          type: 'INFO',
        });
        phase.phase = 'IDLE';
        phase.destinationId = null;
        phase.path = null;
        phase.nextWaypointId = null;
        phase.currentWaypointId = snapToWaypoint(
          robot.position.x, robot.position.z
        );
        phase.phaseStartedAt = nowMs;
        phase.lastPlanAt = 0;
      } else {
        useFleetStore.getState().updateRobot(robot.id, {
          battery: newBattery,
        });
      }
      continue;
    }

    // ---------- OBSTACLE ----------
    if (phase.phase === 'OBSTACLE') {
      if (nowMs - phase.phaseStartedAt > 2000) {
        phase.phase = 'MOVING';
        phase.phaseStartedAt = nowMs;
      }
      continue;
    }
  }
}

// -------- Motion loop (30 Hz) --------
function applyMotion(
  robot: AMR,
  phase: RobotPhase,
  dtSec: number
): void {
  if (phase.phase !== 'MOVING') return;
  if (!phase.nextWaypointId) return;
  if (phase.reachedTarget) return;

  const targetWp = WAYPOINT_MAP[phase.nextWaypointId];
  if (!targetWp) return;

  const dx = targetWp.x - robot.position.x;
  const dz = targetWp.z - robot.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist < ARRIVAL_TOL) {
    // Snap to waypoint exactly
    useFleetStore.getState().updateRobot(robot.id, {
      position: { x: targetWp.x, y: 0, z: targetWp.z },
      speed: 0,
    });
    phase.reachedTarget = true;
    return;
  }

  let newSpeed = robot.speed + ACCEL * dtSec;
  if (dist < 1.0) newSpeed = robot.speed - DECEL * dtSec;
  newSpeed = Math.max(0, Math.min(MAX_SPEED, newSpeed));

  const step = Math.min(newSpeed * dtSec, dist);
  const nx = robot.position.x + (dx / dist) * step;
  const nz = robot.position.z + (dz / dist) * step;

  useFleetStore.getState().updateRobot(robot.id, {
    position: { x: nx, y: 0, z: nz },
    speed: newSpeed,
    distanceTravelled: robot.distanceTravelled + step,
    battery: Math.max(0, robot.battery - 0.02 * dtSec),
  });
}

// -------- Hook --------
export function useSimulationLoop(): void {
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastCoordTickRef = useRef<number>(0);
  const lastStartRef = useRef<number>(0);
  const phasesRef = useRef<Map<string, RobotPhase>>(new Map());

  useEffect(() => {
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);

      if (now - lastFrameRef.current < 33) return;
      const deltaMs = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const store = useFleetStore.getState();
      if (!store.isRunning || store.isEmergencyStopped) return;

      // Reset handling
      if (lastStartRef.current !== store.simulationStartedAt) {
        lastStartRef.current = store.simulationStartedAt;
        phasesRef.current.clear();
        routeRegistry.clear();
        pheromoneMap.clear();
      }

      const nowMs = performance.now();
      const speedMultiplier = store.simulationSpeed;
      const dtSec =
        (deltaMs / 1000) * speedMultiplier;

      // Coordinator tick (5 Hz)
      if (nowMs - lastCoordTickRef.current > COORD_TICK_MS) {
        lastCoordTickRef.current = nowMs;
        runCoordinator(store.robots, phasesRef.current, nowMs);
      }

      // Motion tick (30 Hz)
      for (const robot of store.robots) {
        if (robot.isEmergencyStopped) continue;
        const phase = phasesRef.current.get(robot.id);
        if (!phase) continue;
        applyMotion(robot, phase, dtSec);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
