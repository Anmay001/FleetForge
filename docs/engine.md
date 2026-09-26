# Engine — Route Coordination

Four pure-TypeScript modules under `src/engine/`. **No React imports** — they can be unit-tested, reused, or polled directly from UI code (the sidebar does exactly that).

```
waypointGraph ──▶ routePlanner (A*) ──▶ routeRegistry (reservations)
                        ▲
                        └── pheromoneMap (cost field)
```

---

## 1. `waypointGraph.ts`

Builds an adjacency graph from `WAYPOINTS` at module load.

```ts
export interface GraphNode {
  id: string;
  x: number;
  z: number;
  neighbors: string[];   // adjacent waypoint IDs on the same lane
}

export const WAYPOINT_GRAPH: Record<string, GraphNode>;
export function findPath(startId: string, goalId: string): string[] | null;
export function snapToWaypoint(x: number, z: number): string | null;
```

### Adjacency rules

Two waypoints are neighbours only when **all** of these hold:

1. They share `x` or share `z` (within `TOL = 0.1`).
2. Their gap on the other axis is a **positive multiple of `LANE_STEP = 4`** — i.e. exactly one or more lane steps, never an off-grid distance.
3. **No other waypoint sits strictly between them** on that lane (`hasWaypointBetween`).

Rule 2 matters because `LANES = [2, 6, 10, 14, 18]` while waypoints sit at `2, 6, 10, 14, 18` — a naive `|Δ| === 4` test would miss `HUB-C (10,10) → RACK-A2 (10,6)` pairs that span two steps, and would connect nodes that are not really lane-adjacent.

### Node set (13)

| Group | IDs |
| --- | --- |
| Charging | `CHARGE-01`, `CHARGE-02` |
| Drop | `DROP-01`, `DROP-02` |
| Rack row A | `RACK-A1` … `RACK-A4` |
| Rack row B | `RACK-B1` … `RACK-B4` |
| Centre | `HUB-C` |

**Connectivity: 13/13 nodes, 0 unreachable pairs.** This was a real bug — the original single-step test left both charging nodes isolated, which stalled every AMR that spawned there.

### Algorithms

| Function | Algorithm | Returns |
| --- | --- | --- |
| `findPath` | BFS | Waypoint IDs `[start, …, goal]` inclusive, or `null` |
| `snapToWaypoint` | linear nearest | Nearest waypoint id for a world position |

---

## 2. `routePlanner.ts`

Cost-aware A\* over `WAYPOINT_GRAPH`.

```ts
export interface PlannerContext {
  reservedSegments: Set<string>;         // segments another robot holds
  occupiedWaypoints: Map<string, string>; // waypoint → robot id
  selfId: string;                         // so we don't penalise ourselves
}

export function planRoute(startId, goalId, ctx): string[] | null;
export function validateLaneAlignment(): boolean;
```

### Cost function

```
edgeCost(a → b) =
      distance(a, b) * (1 + pheromone(a, b) * 6.0)     // congestion
    + 100  if segment a|b is reserved by someone else
    +  50  if waypoint b is occupied by someone else
```

| Constant | Value | Meaning |
| --- | ---: | --- |
| `PHEROMONE_COST_FACTOR` | 6.0 | How strongly congestion steers the planner |
| `RESERVED_SEGMENT_PENALTY` | 100.0 | Avoid a segment another robot is committed to |
| `OCCUPIED_WAYPOINT_PENALTY` | 50.0 | Avoid stepping onto an occupied node |

The heuristic is Euclidean distance, so A\* stays admissible on the base distance and the penalties only make it *more* eager to detour.

`selfId` is compared against occupancy before applying the 50-point penalty — a robot is never charged for the node it already occupies.

### `validateLaneAlignment()`

Sanity check used before planning: every neighbour must share an axis with its node, and every node must sit on a real lane. Returns `false` if the graph has been corrupted.

---

## 3. `pheromoneMap.ts`

A stigmergy-style cost field that makes the fleet spread across lanes instead of all taking the shortest corridor.

```ts
export function segmentKey(a: string, b: string): string;  // canonical "A|B"
export const pheromoneMap: PheromoneMap;
```

| Method | Behaviour |
| --- | --- |
| `deposit(fromId, toId, amount?)` | Adds pheromone (default `0.35`) to a canonical segment |
| `get(fromId, toId)` | Current level, `0 … 1` |
| `decay(nowMs)` | Evaporates 8 % per second since the last decay |
| `size()`, `entries()` | Introspection (used by dev tooling) |
| `clear()` | Reset — called by `resetSimulation()` |

| Constant | Value |
| --- | --- |
| `DEPOSIT_AMOUNT` | 0.35 per traversal |
| `DECAY_PER_SEC` | 0.08 (8 %/s) |
| `MAX_PHEROMONE` | 1.0 |

`segmentKey` canonicalises order (`A|B` === `B|A`) so both directions of travel share one bucket — mirrored by `routePlanner.canonicalSegment`.

---

## 4. `routeRegistry.ts`

The reservation layer. A singleton class holding two maps.

```ts
export interface RoutePublication {
  robotId: string;
  path: string[];              // remaining waypoints; path[0] = current
  nextWaypointId: string | null;
  publishedAt: number;
}

export const routeRegistry: RouteRegistry;
```

| Method | Behaviour |
| --- | --- |
| `publish(robotId, path, nextWaypointId)` | Record the robot's current plan |
| `unpublish(robotId)` | Drop a plan |
| `get(robotId)` | Read a publication |
| `lockWaypoint(waypointId, robotId)` | Acquire; `true` if free, expired, or already ours |
| `refreshLock(waypointId, robotId)` | Extend the TTL while still holding |
| `releaseWaypoint(waypointId, robotId)` | Release (no-op if someone else holds it) |
| `owner(waypointId)` | Current holder or `null` |
| `occupiedWaypoints(excludeRobotId?)` | `Map<waypointId, robotId>` |
| `reservedSegments(excludeRobotId?)` | `Set<"A\|B">` derived from published paths |
| `tick()` | Sweep expired locks and stale publications |
| `lockCount()` | Live count for the sidebar |
| `clear()` | Reset — called by `resetSimulation()` |

| Constant | Value | Meaning |
| --- | ---: | --- |
| `LOCK_TTL_MS` | 8000 | A lock not refreshed within 8 s expires |
| `PUBLICATION_TTL_MS` | 15000 | A route not republished within 15 s is dropped |

### Reservation algorithm (per robot, per coordinator tick)

```
1. ctx      = { reservedSegments(self), occupiedWaypoints(self), selfId }
2. dest     = pickDestination(robot)
3. path     = planRoute(current, dest, ctx)
4. next     = path[1]
5. if lockWaypoint(next, self):
       publish(self, path, next)     →  start moving
   else:
       phase = WAITING               →  yield / back off
6. on each arrival: releaseWaypoint(current) → lockWaypoint(next) → publish
```

**Liveness:** TTLs guarantee progress. A robot that is emergency-stopped or reset mid-route releases nothing, but its locks expire after 8 s and its publication after 15 s, so the rest of the fleet routes around it without any manual cleanup.

---

## Coordination sequence

```
   t=0      A plans RACK-A2, locks it, publishes
   t=0.2    B plans, sees A's segment reserved (+100) and RACK-A2 occupied (+50)
            → chooses an alternative corridor via HUB-C
   t=0.6    A arrives, releases RACK-A2, locks HUB-C, republishes
   t=8.0    routeRegistry.tick() sweeps anything stale
```

---

## Integration points

| Caller | Uses |
| --- | --- |
| `hooks/useSimulationLoop.ts` | `planRoute`, `buildContext`, `lockWaypoint`, `publish`, `releaseWaypoint`, `pheromoneMap.decay` |
| `components/common/Sidebar.tsx` | `routeRegistry.lockCount()`, `reservedSegments().size`, `WAYPOINT_GRAPH` node count (1 Hz) |
| `store/useFleetStore.ts` → `resetSimulation()` | `routeRegistry.clear()`, `pheromoneMap.clear()` |

---

## Extending the engine

| Goal | Change |
| --- | --- |
| Add a waypoint | Add it to `WAYPOINTS` in `data/warehouseLayout.ts` — adjacency, graph, planner and registry all derive from it |
| Reshape lanes | Change `LANES` and `LANE_STEP`; keep waypoints on multiples of the step |
| Tune congestion response | `PHEROMONE_COST_FACTOR`, `DEPOSIT_AMOUNT`, `DECAY_PER_SEC` |
| Change lock behaviour | `LOCK_TTL_MS` — raise it for stricter exclusivity, lower it for a more permissive fleet |
| Add a new cost term | Extend `PlannerContext` and `edgeCost()` |
