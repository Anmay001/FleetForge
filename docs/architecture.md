# Architecture

FleetForge is a single-page React application with no backend. Everything — rendering, simulation, routing and coordination — runs in the browser tab.

## Layered view

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 · VIEW                                               │
│  App.tsx  →  AppShell (Header + Sidebar)  →  page components  │
│  React 19 · Tailwind design system (.ff-*) · lucide icons     │
├──────────────────────────────────────────────────────────────┤
│  LAYER 2 · STATE                                              │
│  useFleetStore (Zustand)   robots · tasks · events ·          │
│                            obstacles · selection · flags      │
│  useThemeStore (Zustand)   light | dark                       │
├──────────────────────────────────────────────────────────────┤
│  LAYER 3 · SIMULATION                                         │
│  useSimulationLoop         5 Hz coordinator + 30 Hz motion    │
│  useTaskGenerator          task production every 10–30 s      │
├──────────────────────────────────────────────────────────────┤
│  LAYER 4 · ENGINE (pure, React-free)                          │
│  waypointGraph  →  routePlanner (A*)  →  routeRegistry        │
│  pheromoneMap (cost field)                    (reservations)  │
├──────────────────────────────────────────────────────────────┤
│  LAYER 5 · SCENE                                              │
│  WarehouseScene (R3F) · AMRs · racks · floor · lights         │
│  Declarative meshes driven by store subscriptions             │
└──────────────────────────────────────────────────────────────┘
```

The engine layer has **zero React imports**. It is plain TypeScript operating on data, which keeps it testable and lets the sidebar poll it directly (live coordinator counters).

## Data flow

```
                 ┌─────────────────────┐
                 │  useFleetStore      │  ← single source of truth
                 │  (Zustand)          │
                 └──────────┬──────────┘
        subscribe           │            actions
   ┌────────────────────────┼───────────────────────────┐
   │                        │                           │
   ▼                        ▼                           ▼
Header / Sidebar        useSimulationLoop          3D Scene (R3F)
KpiStrip / Telemetry    1. read robots             reads positions
FleetGrid / Tasks       2. build PlannerContext    writes nothing
EventFeed / Analytics   3. A* plan + reserve
                        4. integrate motion
                        5. updateRobot / addEvent
```

Key rule: **components never mutate robot state directly except through explicit operator actions** (`updateRobot`, `selectRobot`, `addTask`, …). The simulation loop is the only writer during normal running.

### Mutation paths

| Writer | What it writes |
| --- | --- |
| `useSimulationLoop` | `robots[].position/speed/battery/status/targetPosition`, `events[]` |
| `useTaskGenerator` | `tasks[]` |
| Operator UI | `selectedRobotId`, `isRunning`, `isEmergencyStopped`, `simulationSpeed`, patch of one robot |
| `resetSimulation()` | restores the initial fleet/tasks/obstacles, clears events and engine state |

## Timing model

| Cadence | Rate | Owner | Work |
| --- | --- | --- | --- |
| Coordinator tick | 5 Hz (`COORD_TICK_MS = 200`) | `runCoordinator` | pick destination, plan route, publish + lock, handle WAIT/arrival timeouts |
| Motion tick | ~30 Hz (rAF frame) | `applyMotion` | accelerate/decelerate, integrate position along the path, drain battery, detect arrival |
| Pheromone decay | on coordinator tick | `pheromoneMap.decay` | 8 %/s evaporation of the cost field |
| Task generation | every 10–30 s | `useTaskGenerator` | create a task if active count < 20 |
| UI clock | 1 s | `Header`, `BatteryHealthCard` | wall clock, simulation uptime |
| Coordinator counters | 1 s | `Sidebar` | read `routeRegistry` + graph node count |

Constants live at the top of [`src/hooks/useSimulationLoop.ts`](../src/hooks/useSimulationLoop.ts):

```ts
ARRIVAL_TOL        = 0.1
MAX_SPEED          = 0.9
ACCEL              = 0.4
DECEL              = 0.8
COORD_TICK_MS      = 200     // 5 Hz decision loop
WAIT_TIMEOUT_MS    = 6000    // force replan after 6 s blocked
REPLAN_COOLDOWN_MS = 1500
```

## Simulation state machine

Per-robot phase (internal, `RobotPhase` in `useSimulationLoop`):

```
IDLE ──task──▶ MOVING ──arrive──▶ ALIGNING ──▶ PICKING_UP ──▶ MOVING
                  │                                                │
                  │ (blocked > 6 s)                                ▼
                  ▼                                             DROPPING ──▶ IDLE
               WAITING ── grant / timeout ─▶ MOVING
                  │
                  ▼
                CHARGING (battery low)   OBSTACLE (random detection)
```

The public `RobotStatus` (`src/types/fleet.ts`) mirrors this for the UI: `IDLE`, `MOVING_TO_PICKUP`, `ALIGNING`, `PICKING_UP`, `CARRYING`, `DROPPING`, `GOING_TO_CHARGE`, `OBSTACLE_DETECTED`, `WAITING`.

`WAITING` means the robot has a valid plan but does not hold the lock on its next waypoint. It yields, backs off, and hard-reroutes after `WAIT_TIMEOUT_MS`.

## Coordination protocol

```
robot A                                   robot B
──────────────────────────────────────────────────────
planRoute()                               planRoute()
  ctx = { reservedSegments(B),             ctx = { reservedSegments(A),
          occupiedWaypoints(B),                     occupiedWaypoints(A) }
          selfId: A }                             selfId: B }
        │                                          │
        └────────── both avoid each other's edges ─┘

lockWaypoint(next, A) → true            lockWaypoint(next, B) → false
publish(A, path)                        stays in WAITING / yields
        │
        │  on arrival: releaseWaypoint → lockWaypoint(next) → publish
        ▼
   TTL sweep on tick() drops stale locks (8 s)
   and stale publications (15 s)
```

TTLs guarantee liveness: if a robot crashes or is e-stopped mid-route, its locks expire and the rest of the fleet routes around it.

## Rendering model

- `WarehouseScene` is declarative R3F. Every mesh reads from the store on each frame of React's render cycle — there is no imperative `useFrame` scene graph mutation except for camera behaviour and the pulsing emergency indicator.
- Robot labels are `drei <Html>` overlays with a 4-tier hierarchy (selected → needs-attention → mover → idle).
- Selection is a raycast: clicking a robot hitbox calls `selectRobot(id)`; clicking empty floor deselects.
- The theme store toggles the `dark` class on `<html>`; `PALETTES` in `three/constants.ts` returns scene colours for the same theme.

## Design patterns

| Pattern | Where |
| --- | --- |
| **Single store** | `useFleetStore` holds all simulation state; no prop drilling of robots/tasks/events |
| **Hook-driven loop** | `useSimulationLoop()` mounted once in `App` owns all timers via `useEffect` + refs |
| **Module singleton** | `routeRegistry`, `pheromoneMap`, `WAYPOINT_GRAPH` — engine state is deliberately outside React |
| **Command / intent actions** | Store exposes `setRunning`, `toggleEmergencyStop`, `updateRobot(patch)` instead of raw setters |
| **Design tokens** | `src/index.css` `@layer components` (`.ff-panel`, `.ff-control`, …) + Tailwind radius/shadow scale |
| **Shared semantic colour** | `src/components/common/status.ts` — one tone map for DOM, inline styles and three.js |
| **Derived view state** | KPI values are computed in render from store selectors, never stored |
| **Pure engine** | `engine/*` has no React import, so it can be unit-tested or reused outside the app |

## Error handling & resilience

- Waypoint locks and route publications are TTL-scoped (8 s / 15 s) so no manual cleanup is needed after an emergency stop or reset.
- `WAIT_TIMEOUT_MS` forces a replan instead of letting a robot wait forever.
- `REPLAN_COOLDOWN_MS` stops robots from thrashing the planner every frame.
- `resetSimulation()` clears `routeRegistry`, `pheromoneMap`, all phases and reservations, then re-bootstraps.
- Operator `Emergency stop` freezes motion but leaves locks to expire naturally.

## File references

| Concern | File |
| --- | --- |
| View routing | `src/App.tsx` |
| Shell layout | `src/components/common/AppShell.tsx` |
| Simulation loop | `src/hooks/useSimulationLoop.ts` |
| Task generation | `src/hooks/useTaskGenerator.ts` |
| Global state | `src/store/useFleetStore.ts` |
| Graph | `src/engine/waypointGraph.ts` |
| A* planner | `src/engine/routePlanner.ts` |
| Reservations | `src/engine/routeRegistry.ts` |
| Cost field | `src/engine/pheromoneMap.ts` |
| Layout constants | `src/data/warehouseLayout.ts` |
| Domain types | `src/types/fleet.ts` |
| Design system | `src/index.css` |
