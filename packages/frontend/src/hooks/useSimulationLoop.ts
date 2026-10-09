import { useEffect, useRef } from 'react';
import { useFleetStore } from '../store/useFleetStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  AMR,
  WAYPOINTS,
  CHARGING_PADS,
  DROP_ZONES,
  WAYPOINT_GRAPH,
  snapToWaypoint,
  planRoute,
  PlannerContext,
  pheromoneMap,
  routeRegistry,
  segmentHitsRack,
  robotsShouldYield,
  robotsOverlap,
  AMR_SAFE_DISTANCE,
  timeToConflict,
  speedScaleFromConflict,
  TraversalOutcome,
  pickWeightedDestination,
  peerMemory,
  chargerRegistry,
} from '@fleetforge/shared';

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
const LOOKAHEAD_SECONDS = 1.5;
const CONFLICT_SAFE_DISTANCE = 0.9;

// -------- Phase tracking --------
interface RobotPhase {
  phase:
    | 'IDLE' | 'MOVING' | 'WAITING' | 'YIELDING' | 'ALIGNING'
    | 'PICKING_UP' | 'DROPPING' | 'CHARGING' | 'OBSTACLE';
  phaseStartedAt: number;
  currentWaypointId: string | null;
  nextWaypointId: string | null;
  path: string[] | null;
  destinationId: string | null;
  waitingSince: number;
  blockedSince: number;
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
    // Prefer a free charger (or one already reserved for us) that's 
    // closest. If all are taken, pick the closest anyway — the 
    // robot will queue at the entry waypoint until it's free.
    const freeId = chargerRegistry.findFreeCharger(
      robot.position.x,
      robot.position.z,
      robot.id
    );
    if (freeId) return freeId;

    // All chargers held — pick the closest one and queue.
    let bestId = CHARGING_PADS[0].id;
    let bestDist = Infinity;
    for (const pad of CHARGING_PADS) {
      const d = Math.hypot(
        pad.x - robot.position.x,
        pad.z - robot.position.z
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
  if (!currentWp) return WAYPOINTS[0].id;

  // Filter candidates by physical constraints (still needed before 
  // scoring — the scorer doesn't know about claimed waypoints)
  const candidates = WAYPOINTS.filter(
    (w) => w.id !== currentWp && !claimed.has(w.id)
  );

  // Weighted selection: pheromone × congestion × distance
  const picked = pickWeightedDestination(candidates, {
    startWaypointId: currentWp,
    startX: robot.position.x,
    startZ: robot.position.z,
    robots: allRobots,
    selfId: robot.id,
    minDistance: 4,
  });
  if (picked) return picked.id;
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

  // Reserve the first lane segment too. If another robot holds it, 
  // we still plan but must wait before entering.
  routeRegistry.lockSegment(startId, nextId, robot.id);

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

  const traversedFrom = phase.currentWaypointId;
  const traversedTo = phase.nextWaypointId;

  // Classify the outcome to weight the deposit
  let outcome: TraversalOutcome;
  if (phase.phase === 'YIELDING') {
    outcome = 'YIELDING';
  } else if (robot.payload !== null) {
    outcome = 'CARRYING';
  } else if (robot.status === 'GOING_TO_CHARGE') {
    outcome = 'GOING_CHARGE';
  } else if (phase.destinationId && phase.destinationId !== 'IDLE') {
    outcome = 'HEADING_PICKUP';
  } else {
    outcome = 'IDLE_RETURN';
  }

  // Deposit pheromone on the segment just traversed
  if (traversedFrom && traversedTo) {
    pheromoneMap.depositOutcome(
      traversedFrom,
      traversedTo,
      outcome
    );
  }

  // Release the segment we just traversed
  if (traversedFrom && traversedTo) {
    routeRegistry.releaseSegment(traversedFrom, traversedTo, robot.id);
  }

  // Release the waypoint we just left
  if (traversedFrom) {
    routeRegistry.releaseWaypoint(traversedFrom, robot.id);
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

  // Check segment ownership before committing to move into it
  const newNext = remaining[1];
  const prevWp = phase.currentWaypointId ?? '';
  const segmentOwner = routeRegistry.segmentOwner(prevWp, newNext);
  if (segmentOwner !== null && segmentOwner !== robot.id) {
    phase.nextWaypointId = null;
    phase.waitingSince = nowMs;
    return 'blocked';
  }
  routeRegistry.lockSegment(prevWp, newNext, robot.id);

  // Try to lock the new next waypoint
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
  peerMemory.decay(nowMs);

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
        blockedSince: 0,
        lastPlanAt: 0,
        reachedTarget: false,
      };
      phases.set(robot.id, phase);
      // Lock initial waypoint
      if (wpId) routeRegistry.lockWaypoint(wpId, robot.id);
    }

    // --- Stall detection ---
    // If this robot has been blocked for more than 4 seconds, 
    // force-unlock: reset the phase to IDLE so it picks a fresh 
    // destination on the next tick.
    if (phase.blockedSince > 0 && nowMs - phase.blockedSince > 4000) {
      // Release any held reservations
      routeRegistry.clearRobotReservations(robot.id);
      chargerRegistry.releaseAllForRobot(robot.id);
      routeRegistry.unpublish(robot.id);

      // Reset phase
      phase.phase = 'IDLE';
      phase.destinationId = null;
      phase.path = null;
      phase.nextWaypointId = null;
      phase.waitingSince = 0;
      phase.blockedSince = 0;
      phase.lastPlanAt = 0;
      phase.phaseStartedAt = nowMs;
      phase.reachedTarget = false;

      // Reset robot status
      useFleetStore.getState().updateRobot(robot.id, {
        status: 'IDLE',
        speed: 0,
        destination: 'IDLE',
      });

      // Log the event once
      useFleetStore.getState().addEvent({
        robotId: robot.id,
        message: `${robot.id} rerouting — blocked for >4s`,
        type: 'WARN',
      });

      continue;
    }

    // ---------- IDLE ----------
    if (phase.phase === 'IDLE') {
      if (nowMs - phase.lastPlanAt < REPLAN_COOLDOWN_MS) continue;
      const destId = pickDestination(robot, robots);
      if (!planAndReserve(robot, destId, phase, nowMs)) continue;

      // If the destination is a charger, reserve it now so other 
      // robots route elsewhere.
      if (CHARGING_PADS.some((p) => p.id === destId)) {
        chargerRegistry.reserve(destId, robot.id);
      }

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
      phase.blockedSince = 0;
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
        // Release all remaining segment locks held by this robot
        if (phase.currentWaypointId) {
          const storedPath = phase.path;
          if (storedPath && storedPath.length > 1) {
            routeRegistry.releaseSegment(
              storedPath[0],
              storedPath[1],
              robot.id
            );
          }
        }

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
        phase.blockedSince = 0;
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

      // Try again to lock the next waypoint and segment
      if (phase.path && phase.path.length >= 2) {
        const newNext = phase.path[1];
        const prevWp = phase.currentWaypointId ?? '';
        const segmentOwner = routeRegistry.segmentOwner(prevWp, newNext);
        if (segmentOwner === null || segmentOwner === robot.id) {
          routeRegistry.lockSegment(prevWp, newNext, robot.id);
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
      }

      // Hard timeout: abandon route, replan from scratch
      if (waited > WAIT_TIMEOUT_MS) {
        useFleetStore.getState().addEvent({
          robotId: robot.id,
          message: `${robot.id} rerouting — path blocked >6s`,
          type: 'WARN',
        });
        // Release everything we hold
        routeRegistry.clearRobotReservations(robot.id);
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
        phase.blockedSince = 0;
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
          phase.blockedSince = 0;
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
        peerMemory.recordSuccess(phase.destinationId ?? '');
        phase.phase = 'IDLE';
        phase.blockedSince = 0;
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
      // Mark the charger as actively charging the first time we enter 
      // this branch.
      const chargerId = phase.destinationId;
      if (chargerId && robot.battery < 90) {
        chargerRegistry.markCharging(chargerId, robot.id);
      }

      const newBattery = Math.min(
        100, robot.battery + 0.5 * (COORD_TICK_MS / 1000)
      );
      if (newBattery >= 90) {
        if (chargerId) {
          chargerRegistry.release(chargerId, robot.id);
        }
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
        phase.blockedSince = 0;
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
        phase.blockedSince = 0;
        phase.phaseStartedAt = nowMs;
      }
      continue;
    }
  }
}

// -------- Motion loop (30 Hz) --------

/**
 * Returns the ID of another AMR that this robot should yield to, 
 * or null if free to move.
 *
 * Priority rule: lower numericId wins. If this robot has lower 
 * numericId than the blocker, it does NOT yield (blocker should 
 * yield instead).
 */
function findBlocker(
  self: AMR,
  others: AMR[],
  nextX: number,
  nextZ: number
): AMR | null {
  for (const other of others) {
    if (other.id === self.id) continue;

    // Project the OTHER robot's position onto the segment self is 
    // about to occupy — actually just use its current position 
    // since we're checking if the NEXT step lands too close.
    const dx = other.position.x - nextX;
    const dz = other.position.z - nextZ;
    const d = Math.hypot(dx, dz);

    if (d < AMR_SAFE_DISTANCE || robotsShouldYield({ x: nextX, z: nextZ }, other.position)) {
      // Someone is too close. Who yields?
      // Lower numericId wins → higher numericId yields.
      if (self.numericId > other.numericId) {
        return other;
      }
      // We have priority — do not yield to this other robot
    }
  }
  return null;
}

/**
 * Compute the yield target for a robot that's backing up to clear 
 * the lane. Returns the previous waypoint's position, or null if 
 * no valid target exists.
 */
function computeYieldTarget(
  phase: RobotPhase
): { x: number; z: number } | null {
  if (!phase.currentWaypointId) return null;
  const wp = WAYPOINT_MAP[phase.currentWaypointId];
  if (!wp) return null;
  return { x: wp.x, z: wp.z };
}

function applyMotion(
  robot: AMR,
  phase: RobotPhase,
  dtSec: number
): void {
  // ===== YIELDING: back up toward the previous waypoint =====
  if (phase.phase === 'YIELDING') {
    const target = computeYieldTarget(phase);
    if (!target) {
      phase.phase = 'MOVING';
      phase.blockedSince = 0;
      return;
    }

    const dx = target.x - robot.position.x;
    const dz = target.z - robot.position.z;
    const dist = Math.hypot(dx, dz);

    // Reached the yield point — hold and wait for the blocker to 
    // clear
    if (dist < ARRIVAL_TOL) {
      phase.phase = 'WAITING';
      phase.phaseStartedAt = performance.now();
      useFleetStore.getState().updateRobot(robot.id, {
        speed: 0,
        status: 'WAITING',
      });
      return;
    }

    // Back up slowly
    const YIELD_SPEED = 0.4;
    const step = Math.min(YIELD_SPEED * dtSec, dist);
    const nx = robot.position.x + (dx / dist) * step;
    const nz = robot.position.z + (dz / dist) * step;

    // Same physical checks as forward motion — no rack, no AMR 
    // overlap during the yield either
    const rackHit = segmentHitsRack(
      robot.position.x,
      robot.position.z,
      nx,
      nz
    );
    if (rackHit !== null) {
      // Can't back up — abort yield, go straight to WAITING
      phase.phase = 'WAITING';
      phase.phaseStartedAt = performance.now();
      useFleetStore.getState().updateRobot(robot.id, {
        speed: 0,
        status: 'WAITING',
      });
      return;
    }

    // Check for AMRs behind us — if the yield target is occupied, 
    // stop here and wait
    const allRobots = useFleetStore.getState().robots;
    for (const other of allRobots) {
      if (other.id === robot.id) continue;
      const odx = other.position.x - nx;
      const odz = other.position.z - nz;
      if (Math.hypot(odx, odz) < AMR_SAFE_DISTANCE) {
        // Don't back into another AMR
        phase.phase = 'WAITING';
        phase.phaseStartedAt = performance.now();
        useFleetStore.getState().updateRobot(robot.id, {
          speed: 0,
          status: 'WAITING',
        });
        return;
      }
    }

    // Commit the backward step. distanceTravelled increments by 
    // half the step — we don't want to reward retreat as much as 
    // forward progress.
    useFleetStore.getState().updateRobot(robot.id, {
      position: { x: nx, y: 0, z: nz },
      speed: YIELD_SPEED,
      distanceTravelled: robot.distanceTravelled + step * 0.5,
      battery: Math.max(0, robot.battery - 0.01 * dtSec),
      status: 'YIELDING',
    });

    return;
  }

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

  // --- Lookahead velocity obstacle check ---
  // Predict whether we'll conflict with another moving AMR within 
  // the horizon. If so, scale our target speed down proportionally 
  // so we decelerate smoothly instead of stopping dead.
  const allRobotsNow = useFleetStore.getState().robots;
  const selfVelX = (dx / dist) * robot.speed;
  const selfVelZ = (dz / dist) * robot.speed;

  let minTTC: number | null = null;
  for (const other of allRobotsNow) {
    if (other.id === robot.id) continue;

    // Estimate other robot's velocity toward its target
    const odx = other.targetPosition.x - other.position.x;
    const odz = other.targetPosition.z - other.position.z;
    const odist = Math.hypot(odx, odz);
    const otherVelX = odist > 0.01
      ? (odx / odist) * other.speed
      : 0;
    const otherVelZ = odist > 0.01
      ? (odz / odist) * other.speed
      : 0;

    const ttc = timeToConflict(
      { x: robot.position.x, z: robot.position.z,
        vx: selfVelX, vz: selfVelZ },
      { x: other.position.x, z: other.position.z,
        vx: otherVelX, vz: otherVelZ },
      LOOKAHEAD_SECONDS,
      CONFLICT_SAFE_DISTANCE
    );
    if (ttc !== null && (minTTC === null || ttc < minTTC)) {
      minTTC = ttc;
    }
  }

  // If no conflict, scale is 1; if conflict, smooth deceleration
  const conflictScale = speedScaleFromConflict(minTTC, LOOKAHEAD_SECONDS);

  let newSpeed = robot.speed + ACCEL * dtSec;
  if (dist < 1.0) newSpeed = robot.speed - DECEL * dtSec;

  // Apply the conflict-driven speed cap. If we have a predicted 
  // conflict, don't let our speed exceed scale × MAX_SPEED.
  const speedCap = MAX_SPEED * conflictScale;
  if (newSpeed > speedCap) newSpeed = speedCap;

  newSpeed = Math.max(0, Math.min(MAX_SPEED, newSpeed));

  const step = Math.min(newSpeed * dtSec, dist);
  const nx = robot.position.x + (dx / dist) * step;
  const nz = robot.position.z + (dz / dist) * step;

  const nowMs = performance.now();

  // --- CHECK 1: Rack collision ---
  // If the segment from current to next crosses any expanded rack 
  // AABB, refuse the move. AMRs must never enter rack footprints.
  const rackHit = segmentHitsRack(
    robot.position.x,
    robot.position.z,
    nx,
    nz
  );
  if (rackHit !== null) {
    // Stop at current position, remember the moment we got stuck
    if (phase.blockedSince === 0) {
      phase.blockedSince = nowMs;
    }
    useFleetStore.getState().updateRobot(robot.id, {
      speed: 0,
      status: 'WAITING',
    });
    return;
  }

  // --- CHECK 2: AMR-AMR proximity ---
  // If another AMR is too close to the next step AND has priority 
  // (lower numericId), hold position.
  const allRobots = useFleetStore.getState().robots;
  const blocker = findBlocker(robot, allRobots, nx, nz);
  if (blocker !== null) {
    if (phase.blockedSince === 0) {
      phase.blockedSince = nowMs;
    }

    // Give H2.1's lookahead 500ms to resolve the conflict before 
    // we commit to yielding.
    const timeBlocked = nowMs - phase.blockedSince;
    if (timeBlocked > 500 && phase.currentWaypointId) {
      // Enter active yielding — back up toward the previous waypoint
      phase.phase = 'YIELDING';
      phase.phaseStartedAt = nowMs;
      useFleetStore.getState().updateRobot(robot.id, {
        status: 'YIELDING',
      });
    } else {
      // Brief wait — the lookahead may resolve this
      useFleetStore.getState().updateRobot(robot.id, {
        speed: 0,
        status: 'WAITING',
      });
      phase.phase = 'WAITING';
      phase.phaseStartedAt = nowMs;
    }
    return;
  }

  // --- CHECK 3: Emergency separation ---
  // Defensive: if we're already overlapping another AMR (should never 
  // happen given checks 1-2, but guards against load-order edge cases), 
  // push both apart along the line between them.
  for (const other of allRobots) {
    if (other.id === robot.id) continue;
    if (robotsOverlap(robot.position, other.position)) {
      const pushX = robot.position.x - other.position.x;
      const pushZ = robot.position.z - other.position.z;
      const pushDist = Math.hypot(pushX, pushZ) || 1;
      const pushAmount = 0.15;
      const newX = robot.position.x + (pushX / pushDist) * pushAmount;
      const newZ = robot.position.z + (pushZ / pushDist) * pushAmount;
      useFleetStore.getState().updateRobot(robot.id, {
        position: { x: newX, y: 0, z: newZ },
        speed: 0,
      });
      return;
    }
  }

  // --- SUCCESS: commit the move ---
  // Clear the blocked tracker since we're moving again.
  phase.blockedSince = 0;

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
        peerMemory.clear();
        chargerRegistry.clear();
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

      // Check auto-reset setting if all tasks complete
      if (useSettingsStore.getState().autoResetOnCompletion) {
        const tasks = store.tasks;
        if (tasks.length > 0 && tasks.every((t) => t.status === 'COMPLETED')) {
          store.resetSimulation();
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
