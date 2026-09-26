# Hooks

FleetForge defines two application hooks. Both are mounted once, at the top of `App.tsx`, and own their timers through `useEffect` cleanup.

```tsx
// src/App.tsx
useSimulationLoop();
useTaskGenerator();
```

---

## `useSimulationLoop()`

**File:** `src/hooks/useSimulationLoop.ts` (505 lines)

Drives the entire fleet simulation. Returns nothing.

### What it does each coordinator tick (5 Hz)

```
runCoordinator(now)
  for each robot:
    1. buildContext(selfId)      → registry occupancy excluding self
    2. pickDestination()         → rack / drop / charge / idle target
    3. planAndReserve()          → A* → lock next waypoint → publish route
    4. handle WAIT arrival / WAIT_TIMEOUT_MS replan
    5. handle phase transitions (align → pick → carry → drop)
  pheromoneMap.decay(now)
  routeRegistry.tick()           → sweep expired locks & publications
```

### What it does each animation frame (≈30 Hz)

```
applyMotion(dt)
  - accelerate / decelerate toward MAX_SPEED
  - integrate along the current path toward the next waypoint
  - arrive within ARRIVAL_TOL → advance phase
  - drain battery, accumulate distanceTravelled
  - push events (obstacle detection, low battery, reroute)
```

### Tuning constants

| Constant | Value | Meaning |
| --- | ---: | --- |
| `ARRIVAL_TOL` | 0.1 | Distance at which a waypoint counts as reached |
| `MAX_SPEED` | 0.9 | m/s ceiling |
| `ACCEL` | 0.4 | m/s² ramp-up |
| `DECEL` | 0.8 | m/s² braking |
| `COORD_TICK_MS` | 200 | 5 Hz decision loop |
| `WAIT_TIMEOUT_MS` | 6000 | Force a replan after 6 s blocked |
| `REPLAN_COOLDOWN_MS` | 1500 | Minimum gap between plans |

### Internal types

```ts
interface RobotPhase {
  phase: 'IDLE' | 'MOVING' | 'WAITING' | 'ALIGNING'
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
```

Kept in a `useRef` map keyed by robot id — it is *simulation* state, not UI state, so it deliberately lives outside the React store.

### Internal functions

| Function | Role |
| --- | --- |
| `buildContext(selfId)` | Snapshot of registry occupancy excluding the requesting robot |
| `pickDestination(robot, allRobots)` | Choose the next goal (task drop, rack pickup, charging pad, or idle) |
| `planAndReserve(...)` | A* plan → acquire the lock on the next waypoint → publish the route |
| `advanceAlongPath(...)` | Move one frame along the current path |
| `runCoordinator(...)` | 5 Hz orchestration for every robot |
| `applyMotion(...)` | Physics + status bookkeeping for one frame |

### Store writes

| Action | When |
| --- | --- |
| `updateRobot(id, patch)` | position, speed, status, battery, destination, target |
| `addEvent({ robotId, message, type })` | obstacle, low battery, reroute, charging, drop-off |

### Cleanup

The `useEffect` cancels its frame loop and timers on unmount. On `reset()` the hook clears `routeRegistry`, `pheromoneMap`, all `RobotPhase` entries and reservations, then re-bootstraps from `initialFleet`.

---

## `useTaskGenerator()`

**File:** `src/hooks/useTaskGenerator.ts` (66 lines)

Creates warehouse tasks on a randomised schedule.

```ts
const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 30_000;
const MAX_ACTIVE_TASKS = 20;
```

### Scheduling

```
scheduleNext()
  delay = MIN + random() * (MAX - MIN)
  setTimeout(scheduleNext, delay)
  if (active < MAX_ACTIVE_TASKS) → addTask({...})
```

`active` = tasks whose status is not `COMPLETED`.

### Helpers

| Helper | Behaviour |
| --- | --- |
| `randomBoxId()` | `BOX-2xx` … `BOX-9xx` |
| `randomPickup()` | A `RACK-*` waypoint |
| `randomDrop()` | A `DROP-*` waypoint |
| `randomRobotId()` | A random robot from the store (defaults to `AMR-01`) |

The effect schedules the first tick immediately and clears the pending timeout on unmount, so StrictMode double-mounting does not leak timers.

---

## Store hooks

Used as selectors throughout the components (see [Components](components.md)).

### `useFleetStore`

| State | Type |
| --- | --- |
| `robots` | `AMR[]` |
| `tasks` | `WarehouseTask[]` |
| `events` | `SimulationEvent[]` |
| `obstacles` | `Obstacle[]` |
| `selectedRobotId` | `string \| null` |
| `isRunning` | `boolean` |
| `isEmergencyStopped` | `boolean` |
| `simulationSpeed` | `0.5 \| 1 \| 2 \| 5` |
| `simulationStartedAt` | `number` |
| `coordinationStats` | `{ totalAssignments; totalConflictsResolved; peakConcurrentRoutes }` |

| Action | Signature |
| --- | --- |
| `selectRobot` | `(id: string \| null) => void` |
| `setRunning` | `(v: boolean) => void` |
| `toggleEmergencyStop` | `() => void` |
| `setSpeed` | `(s: 0.5 \| 1 \| 2 \| 5) => void` |
| `updateRobot` | `(id: string, patch: Partial<AMR>) => void` |
| `addEvent` | `(e: Omit<SimulationEvent, 'id' \| 'timestamp'>) => void` |
| `addTask` | `(t: Omit<WarehouseTask, 'id' \| 'createdAt'>) => void` |
| `addObstacle` | `(o: Omit<Obstacle, 'id'>) => void` |
| `resetSimulation` | `() => void` |

### `useThemeStore`

```ts
type Theme = 'light' | 'dark';
{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }
```

`App.tsx` syncs `theme` to the `dark` class on `document.documentElement`.

---

## Selector hygiene

Always select the narrowest slice you need so unrelated updates do not re-render:

```tsx
// good — only re-renders when this robot changes
const robot = useFleetStore((s) => s.robots.find((r) => r.id === s.selectedRobotId));

// avoid — re-renders on every store write
const store = useFleetStore();
```

Note that a selector returning a new object/array identity each call will re-render every time; derive scalars, or select the raw array and compute in the component body with `useMemo`.
