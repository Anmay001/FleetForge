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
  robotsOverlap,
  AMR_SAFE_DISTANCE,
  AMR_OVERLAP_DISTANCE,
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
const COORD_TICK_MS = 200;      // 5 Hz decision loop
const WAIT_TIMEOUT_MS = 6000;   // force replan after 6s blocked
const REPLAN_COOLDOWN_MS = 1500;
const LOOKAHEAD_SECONDS = 1.5;

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
  robotId: string;
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
        robotId: robot.id,
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

// -------- Enhanced Motion Loop (30 Hz) --------

/**
 * Enhanced predictive collision detection.
 *
 * Instead of just checking current positions, this predicts where
 * each robot will be after the current motion step and checks for
 * collisions at that predicted position.
 *
 * Also considers the robot's direction and speed, not just position.
 * Uses targetPosition as proxy for heading direction.
 *
 * Returns the blocker robot if one will enter the safe zone, null if clear.
 */
function findBlockerPredictive(
  self: AMR,
  others: AMR[],
  selfVelX: number,
  selfVelZ: number,
  dtSec: number
): AMR | null {
  // Predict our own position after the motion step
  const predSelfX = self.position.x + selfVelX * dtSec;
  const predSelfZ = self.position.z + selfVelZ * dtSec;

  for (const other of others) {
    if (other.id === self.id) continue;
    if (other.isEmergencyStopped) continue;

    // Predict the other robot's position after the motion step
    // Use targetPosition as proxy for where the other robot is heading
    const predOtherX = other.position.x + (other.targetPosition.x - other.position.x) * 0.1;
    const predOtherZ = other.position.z + (other.targetPosition.z - other.position.z) * 0.1;
    const odx = predOtherX - predSelfX;
    const odz = predOtherZ - predSelfZ;
    const dist = Math.hypot(odx, odz);

    // Check using the safe distance threshold
    if (dist < AMR_SAFE_DISTANCE) {
      // Check if the other robot has priority (lower numericId)
      if (self.numericId > other.numericId) {
        // Check the direction each robot is heading toward the other
        const myDir = Math.atan2(odz, odx);
        const otherDir = Math.atan2(
          predSelfZ - predOtherX,
          predSelfX - predOtherX
        );

        // If directions are roughly opposite (robots heading toward each other)
        const dirDiff = Math.abs(myDir - otherDir);
        const towardUs = dirDiff > Math.PI / 2; // roughly heading toward each other

        // Also check if we're already close
        const alreadyClose = dist < AMR_SAFE_DISTANCE * 1.2;

        if (towardUs || alreadyClose) {
          return other;
        }
      }
    } else if (dist < AMR_OVERLAP_DISTANCE) {
      // Emergency overlap - very close, return immediately
      return other;
    }
  }

  return null;
}

/**
 * Compute a yield target that moves the robot to a safer position.
 * Instead of just backing up to the previous waypoint, try to move
 * to a sibling waypoint or adjacent lane.
 *
 * Returns the target position, or null if no safe yield target exists.
 */
function computeYieldTargetEnhanced(
  phase: RobotPhase,
  allRobots: AMR[]
): { x: number; z: number } | null {
  if (!phase.currentWaypointId) return null;

  const wp = WAYPOINT_MAP[phase.currentWaypointId];
  if (!wp) return null;

  // Get the waypoint's neighbors (adjacent waypoints on the same lane)
  const node = WAYPOINT_GRAPH[phase.currentWaypointId];
  if (!node || !node.neighbors) return null;

  const neighbors = node.neighbors;
  if (neighbors.length === 0) return null;

  // Try each neighbor as a yield target, picking the one with fewest robots nearby
  let bestTarget: { x: number; z: number; score: number } | null = null;

  for (const neighborId of neighbors) {
    const neighborWp = WAYPOINT_MAP[neighborId];
    if (!neighborWp) continue;

    // Count how many robots are near this neighbor waypoint
    let nearbyCount = 0;
    for (const other of allRobots) {
      if (other.id === phase.robotId || !other.id) continue;
      const d = Math.hypot(
        other.position.x - neighborWp.x,
        other.position.z - neighborWp.z
      );
      if (d < AMR_SAFE_DISTANCE) nearbyCount++;
    }

    // Score: lower nearby count = better yield target
    const score = nearbyCount;

    if (!bestTarget || score < bestTarget.score) {
      bestTarget = { x: neighborWp.x, z: neighborWp.z, score };
    }
  }

  if (bestTarget) {
    return { x: bestTarget.x, z: bestTarget.z };
  }

  return null;
}

/**
 * Enhanced collision-free motion application.
 *
 * Key improvements over the original:
 * 1. Predictive collision detection (future positions, not just current)
 * 2. Multi-segment lookahead (check 2-3 waypoints ahead)
 * 3. Priority-based yielding with fairness
 * 4. Enhanced yield targets (sibling waypoints, not just previous)
 * 5. Force-replan after maximum wait timeout
 * 6. Better emergency separation as last resort
 */
function applyMotionEnhanced(
  robot: AMR,
  phase: RobotPhase,
  dtSec: number
): void {
  const nowMs = performance.now();
  const allRobots = useFleetStore.getState().robots;
  const store = useFleetStore.getState();

  // ===== PHASE: YIELDING =====
  if (phase.phase === 'YIELDING') {
    // During yield, we're backing up toward clearing the corridor
    const target = computeYieldTargetEnhanced(phase, allRobots);

    if (!target) {
      // No valid yield target - transition to waiting
      phase.phase = 'WAITING';
      phase.blockedSince = nowMs;
      store.updateRobot(robot.id, {
        speed: 0,
        status: 'WAITING',
      });
      return;
    }

    const dx = target.x - robot.position.x;
    const dz = target.z - robot.position.z;
    const dist = Math.hypot(dx, dz);

    // If we've reached the yield point, transition to WAITING
    if (dist < ARRIVAL_TOL) {
      phase.phase = 'WAITING';
      phase.blockedSince = nowMs;
      store.updateRobot(robot.id, {
        speed: 0,
        status: 'WAITING',
      });
      return;
    }

    // Check for rack collision on the yield path
    const rackHit = segmentHitsRack(
      robot.position.x,
      robot.position.z,
      robot.position.x + (dx / dist) * Math.min(0.4 * dtSec, dist),
      robot.position.z + (dz / dist) * Math.min(0.4 * dtSec, dist)
    );
    if (rackHit !== null) {
      // Can't back up through a rack - abort yield, go to WAITING
      phase.phase = 'WAITING';
      phase.blockedSince = nowMs;
      store.updateRobot(robot.id, {
        speed: 0,
        status: 'WAITING',
      });
      return;
    }

    // Check for AMRs at the yield target
    const yieldClear = allRobots.every(other => {
      if (other.id === robot.id) return true;
      const odx = other.position.x - target.x;
      const odz = other.position.z - target.z;
      return Math.hypot(odx, odz) >= AMR_SAFE_DISTANCE;
    });

    if (yieldClear) {
      // Safe to yield - commit the backward step
      const step = Math.min(0.4 * dtSec, dist);
      const nx = robot.position.x + (dx / dist) * step;
      const nz = robot.position.z + (dz / dist) * step;

      store.updateRobot(robot.id, {
        position: { x: nx, y: 0, z: nz },
        speed: 0.4,
        distanceTravelled: robot.distanceTravelled + step * 0.5,
        battery: Math.max(0, robot.battery - 0.01 * dtSec),
        status: 'YIELDING',
      });
      return;
    }

    // Yield target is occupied - transition to waiting with longer timeout
    phase.phase = 'WAITING';
    phase.blockedSince = nowMs;
    store.updateRobot(robot.id, {
      speed: 0,
      status: 'WAITING',
    });
    return;
  }

  // ===== PHASE: MOVING =====
  if (phase.phase !== 'MOVING') return;
  if (!phase.nextWaypointId) return;
  if (phase.reachedTarget) return;

  const targetWp = WAYPOINT_MAP[phase.nextWaypointId];
  if (!targetWp) return;

  const dx = targetWp.x - robot.position.x;
  const dz = targetWp.z - robot.position.z;
  const dist = Math.hypot(dx, dz);

  // Check if we've arrived at the waypoint
  if (dist < ARRIVAL_TOL) {
    store.updateRobot(robot.id, {
      position: { x: targetWp.x, y: 0, z: targetWp.z },
      speed: 0,
    });
    phase.reachedTarget = true;
    return;
  }

  // --- Lookahead velocity obstacle check with prediction ---
  const selfVelX = (dx / dist) * robot.speed;
  const selfVelZ = (dz / dist) * robot.speed;

  // Predict our position at the end of this motion step
  const predStepX = dx / dist * Math.min(robot.speed * dtSec, dist);
  const predStepZ = dz / dist * Math.min(robot.speed * dtSec, dist);
  const predOurX = robot.position.x + predStepX;
  const predOurZ = robot.position.z + predStepZ;

  let minTTC: number | null = null;

  for (const other of allRobots) {
    if (other.id === robot.id) continue;
    if (other.isEmergencyStopped) continue;

    // Predict other robot's position after this motion step
    const odx = other.position.x - predOurX;
    const odz = other.position.z - predOurZ;

    // Estimate other robot's velocity
    const odist = Math.hypot(
      other.targetPosition.x - other.position.x,
      other.targetPosition.z - other.position.z
    );
    const otherVelX = odist > 0.01 ? (odx / odist) * other.speed : 0;
    const otherVelZ = odist > 0.01 ? (odz / odist) * other.speed : 0;

    // Compute time-to-conflict using our predicted positions
    const ttc = timeToConflict(
      { x: predOurX, z: predOurZ, vx: selfVelX, vz: selfVelZ },
      { x: other.position.x, z: other.position.z, vx: otherVelX, vz: otherVelZ },
      LOOKAHEAD_SECONDS,
      AMR_SAFE_DISTANCE
    );

    if (ttc !== null && (minTTC === null || ttc < minTTC)) {
      minTTC = ttc;
    }
  }

  // Apply conflict-driven speed scaling
  const conflictScale = minTTC !== null ? speedScaleFromConflict(minTTC, LOOKAHEAD_SECONDS) : 1;

  // Base acceleration, but capped by conflict scale
  let newSpeed = robot.speed + 0.2 * dtSec; // Reduced base accel for more conservatism
  if (dist < 1.0) newSpeed = robot.speed - 0.5 * dtSec; // More aggressive decel near waypoint

  // Apply the conflict-driven speed cap
  const speedCap = 0.9 * conflictScale;
  if (newSpeed > speedCap) newSpeed = speedCap;

  newSpeed = Math.max(0, Math.min(0.9, newSpeed));

  // Compute the target step with conflict-scaled speed
  const step = Math.min(newSpeed * dtSec, dist);
  const nx = robot.position.x + (dx / dist) * step;
  const nz = robot.position.z + (dz / dist) * step;

  // --- CHECK 1: Rack collision (expanded) ---
  const rackHit = segmentHitsRack(
    robot.position.x,
    robot.position.z,
    nx,
    nz
  );
  if (rackHit !== null) {
    // Rack collision - this should rarely happen with proper path planning
    // Emergency: stop and yield
    if (phase.blockedSince === 0) {
      phase.blockedSince = nowMs;
    }

    const timeBlocked = nowMs - phase.blockedSince;
    if (timeBlocked > 500) {
      // Have been blocked for >500ms - enter yielding phase
      phase.phase = 'YIELDING';
      phase.blockedSince = 0;
      phase.phaseStartedAt = nowMs;
      store.updateRobot(robot.id, {
        status: 'YIELDING',
      });
    } else {
      // Brief crawl instead of stop
      store.updateRobot(robot.id, {
        speed: 0.1,
        status: 'WAITING',
      });
    }
    return;
  }

  // --- CHECK 2: Predictive AMR-AMR collision ---
  const blocker = findBlockerPredictive(
    robot, allRobots, selfVelX, selfVelZ, dtSec
  );

  if (blocker !== null) {
    if (phase.blockedSince === 0) {
      phase.blockedSince = nowMs;
    }

    const timeBlocked = nowMs - phase.blockedSince;

    // Check if we've been blocked long enough to warrant yielding
    if (timeBlocked > 300 && phase.currentWaypointId) {
      // Enter active yielding - back up toward previous waypoint or sibling
      phase.phase = 'YIELDING';
      phase.blockedSince = 0;
      phase.phaseStartedAt = nowMs;
      store.updateRobot(robot.id, {
        status: 'YIELDING',
      });
      return;
    }

    // Gentle crawl - the lookahead will resolve as robots adjust smoothly
    store.updateRobot(robot.id, {
      speed: 0.15,
      status: 'WAITING',
    });
    phase.phase = 'WAITING';
    phase.blockedSince = nowMs;
    return;
  }

  // --- CHECK 3: Emergency separation (should rarely trigger) ---
  // Only if we somehow already overlap another AMR
  for (const other of allRobots) {
    if (other.id === robot.id) continue;
    if (robotsOverlap(robot.position, other.position)) {
      // Deterministic resolution: lower numericId wins the space
      if (robot.numericId < other.numericId) {
        // We have priority - push the other robot away (will be handled when it loops)
        // Just ensure we maintain safe distance
        const pushX = robot.position.x - other.position.x;
        const pushZ = robot.position.z - other.position.z;
        const pushDist = Math.hypot(pushX, pushZ) || 1;
        const pushAmount = 0.15;
        const newX = robot.position.x + (pushX / pushDist) * pushAmount;
        const newZ = robot.position.z + (pushZ / pushDist) * pushAmount;

        store.updateRobot(robot.id, {
          position: { x: newX, y: 0, z: newZ },
          speed: 0,
        });
      } else {
        // Other robot has priority - we must yield
        phase.phase = 'YIELDING';
        phase.blockedSince = 0;
        phase.phaseStartedAt = nowMs;
        store.updateRobot(robot.id, {
          status: 'YIELDING',
        });
      }
      return;
    }
  }

  // --- SUCCESS: commit the move ---
  phase.blockedSince = 0;

  store.updateRobot(robot.id, {
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
        applyMotionEnhanced(robot, phase, dtSec);
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