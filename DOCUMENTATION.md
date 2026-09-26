# FleetForge

> **Autonomous Fleet Coordination Dashboard for Smart Warehouse Environments**
> Built for **Smart India Hackathon 2026** — Problem Statement **SIH-26123**

FleetForge is a production-grade, fully client-side dashboard that simulates and visualizes a fleet of Autonomous Mobile Robots (AMRs) coordinating pick-and-drop tasks in a warehouse. It runs entirely in the browser — **no backend, no API keys, no external services required**.

> **Quick navigation:** [Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Architecture](#-architecture) · [Coordination Engine](#-coordination-engine) · [Project Structure](#-project-structure) · [Components](#-components) · [Hooks & State](#-hooks--state) · [Design System](#-design-system) · [Configuration](#-configuration) · [Performance](#-performance) · [Validation](#-validation) · [Use Cases](#-use-cases) · [Roadmap](#-roadmap)

Modular docs also live in [`docs/`](docs/README.md).

---

## ✨ Features

### Real-time 3D Digital Twin

- Five autonomous robots navigating a 20×20 m warehouse rendered in Three.js
- Live AMR positions, battery drain, payload state, and task assignments
- Orbit, pan, and zoom camera controls with Follow AMR mode
- Top View / 3D View switching, camera reset and fullscreen
- Light and dark themes driven by the same store as the UI

### HiveMind Coordination Engine

- Ant-colony inspired pheromone trails on lane segments
- A\* pathfinding weighted by traffic congestion and reservations
- Waypoint lock system with TTL-based auto-expiry
- Every robot publishes its planned route — others route around it
- Yield-and-backoff waiting with a hard replan timeout — prevents deadlock

### Operator Interface

- Live telemetry inspector for each AMR (position, speed, task, battery)
- Task queue with sorting, filtering, and auto-generation every 10–30 s
- Real-time event feed with timestamped state changes
- 11 live KPIs spanning deliveries, utilization, distance, and coordination metrics
- Emergency stop and per-robot commands (Stop, Pause, Resume, Reroute, Charge)

### Warehouse Layout

- **13 waypoints** on a lane-aligned grid (x, z ∈ {2, 6, 10, 14, 18})
- **8 storage racks** in a 2×4 layout, one per cell
- **2 charging pads** and **2 drop zones** at corner intersections
- **4 dynamic obstacles** that can be added at runtime

### The Seven Views

| View | What it shows |
|---|---|
| Dashboard | 11 KPIs, distance-per-robot bars, battery health |
| 3D Simulation | KPI strip, command toolbar, live scene, telemetry rail, event log |
| Fleet Management | Per-robot cards with live status badges |
| Task Management | KPI ribbon, sim-speed control, sortable/filterable queue |
| Event Feed | Full-height chronological log |
| Analytics | KPI grid, distance-per-robot bars, battery health |
| Settings | Appearance, simulation and display preferences |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Build | Vite 5 |
| Framework | React 19 |
| Language | TypeScript 5.x (strict mode, no `any`) |
| Styling | Tailwind CSS 3.4 |
| State | Zustand |
| 3D Rendering | Three.js + `@react-three/fiber` + `@react-three/drei` |
| Icons | lucide-react |
| Typography | Inter Variable |
| Routing | In-app view switching (no URL router) |

### Notable absences

No database. No auth. No API server. No environment variables. No third-party services. `npm install && npm run dev` is the entire setup.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install and Run

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
# → http://localhost:5173

# Type check
npx tsc --noEmit

# Production build
npm run build
# → dist/

# Serve the production build
npm run preview
```

### Environment Variables

**None required.** There is no `.env` file in this repository.

If you add any later, remember Vite inlines every `VITE_`-prefixed variable into the client bundle — anything there is public. Server-side secrets must never ship to the browser.

### Deployment

| Item | Value |
|---|---|
| Repository | https://github.com/Anmay001/FleetForge |
| Branch | `main` |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Hosting | Netlify continuous deployment from `main` |

Pushing to `main` triggers an automatic rebuild. Pull requests get deploy previews.

---

## 🧭 Architecture

### Five layers

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 · VIEW                                               │
│  App.tsx  →  AppShell (Header + Sidebar)  →  page components  │
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
│  waypointGraph → routePlanner (A*) → routeRegistry            │
│  pheromoneMap (cost field)     (reservations)                 │
├──────────────────────────────────────────────────────────────┤
│  LAYER 5 · SCENE                                              │
│  WarehouseScene (R3F) · AMRs · racks · floor · lights         │
└──────────────────────────────────────────────────────────────┘
```

The engine layer has **zero React imports**. It is plain TypeScript operating on data — which is why the sidebar can poll it directly for live coordinator counters.

### Data flow

```
                 ┌─────────────────────┐
                 │  useFleetStore      │  ← single source of truth
                 └──────────┬──────────┘
        subscribe           │            actions
   ┌────────────────────────┼───────────────────────────┐
   ▼                        ▼                           ▼
Header / Sidebar        useSimulationLoop          3D Scene (R3F)
KpiStrip / Telemetry    1. read robots             reads positions
FleetGrid / Tasks       2. build PlannerContext    writes nothing
EventFeed / Analytics   3. A* plan + reserve
                        4. integrate motion
                        5. updateRobot / addEvent
```

**Rule:** components never mutate robot state directly except through explicit operator actions. During normal running, the simulation loop is the only writer.

### Timing model

| Cadence | Rate | Owner | Work |
|---|---|---|---|
| Coordinator tick | 5 Hz | `runCoordinator` | pick destination, plan route, publish + lock, handle WAIT/arrival timeouts |
| Motion tick | ~30 Hz | `applyMotion` | accelerate/decelerate, integrate position, drain battery |
| Pheromone decay | 5 Hz | `pheromoneMap.decay` | 8 %/s evaporation |
| Task generation | 10–30 s | `useTaskGenerator` | create a task if active < 20 |
| Sidebar counters | 1 s | `Sidebar` | read registry + graph node count |
| UI clock | 1 s | `Header` | wall clock and uptime |

### Design patterns

| Pattern | Where |
|---|---|
| Single store | `useFleetStore` holds all simulation state — no prop drilling |
| Hook-driven loop | `useSimulationLoop()` mounted once; owns all timers with cleanup |
| Module singletons | `routeRegistry`, `pheromoneMap`, `WAYPOINT_GRAPH` live outside React |
| Command/intent actions | `setRunning`, `toggleEmergencyStop`, `updateRobot(patch)` |
| Design tokens | `@layer components` `.ff-*` classes + forced Tailwind radius scale |
| Shared semantic colour | `status.ts` — one tone map for DOM, inline styles and three.js |
| Derived view state | KPIs computed during render, never stored |
| Pure engine | `engine/*` has no React import — unit-testable as-is |

---

## 🐜 Coordination Engine

Four pure-TypeScript modules in `src/engine/`:

```
waypointGraph ──▶ routePlanner (A*) ──▶ routeRegistry (reservations)
                        ▲
                        └── pheromoneMap (cost field)
```

### 1 · Waypoint graph

Adjacency is derived from the lane grid. Two waypoints are neighbours only when they share an axis, sit an exact multiple of `LANE_STEP = 4` apart, and have **no other waypoint between them**.

```ts
export const WAYPOINT_GRAPH: Record<string, GraphNode>;
export function findPath(startId, goalId): string[] | null;   // BFS
export function snapToWaypoint(x, z): string | null;
```

**Connectivity: 13/13 nodes, 0 unreachable pairs.** (The original single-step test left both charging nodes isolated and stalled every AMR that spawned there.)

### 2 · A\* planner

```
edgeCost(a → b) =
      distance(a, b) * (1 + pheromone(a, b) * 6.0)   // congestion
    + 100  if segment a|b is reserved by someone else
    +  50  if waypoint b is occupied by someone else
```

| Constant | Value | Meaning |
|---|---:|---|
| `PHEROMONE_COST_FACTOR` | 6.0 | How strongly congestion steers the planner |
| `RESERVED_SEGMENT_PENALTY` | 100.0 | Avoid a segment another robot is committed to |
| `OCCUPIED_WAYPOINT_PENALTY` | 50.0 | Avoid stepping onto an occupied node |

The heuristic is Euclidean, so A\* stays admissible on base distance while penalties only make it *more* eager to detour. `selfId` is checked before the occupancy penalty — a robot is never charged for the node it already holds.

### 3 · Pheromone cost field

| Constant | Value | Behaviour |
|---|---:|---|
| `DEPOSIT_AMOUNT` | 0.35 | deposited per traversal |
| `DECAY_PER_SEC` | 0.08 | evaporates 8 % per second |
| `MAX_PHEROMONE` | 1.0 | saturation |

Segments are keyed canonically (`A|B` === `B|A`) so both directions of travel share one bucket. The result: traffic naturally disperses after a jam instead of everyone piling into the same corridor.

### 4 · Reservation registry

```ts
export interface RoutePublication {
  robotId: string;
  path: string[];               // remaining waypoints; path[0] = current
  nextWaypointId: string | null;
  publishedAt: number;
}
```

| Method | Behaviour |
|---|---|
| `publish(robotId, path, next)` | Record the robot's current plan |
| `lockWaypoint(wp, robot)` | Acquire — succeeds if free, expired, or already ours |
| `refreshLock` / `releaseWaypoint` | Maintain or drop a lock |
| `occupiedWaypoints(exclude)` | `Map<waypointId, robotId>` |
| `reservedSegments(exclude)` | `Set<"A\|B">` derived from published paths |
| `tick()` | Sweep expired locks and stale publications |

| Constant | Value | Meaning |
|---|---:|---|
| `LOCK_TTL_MS` | 8000 | An unrefreshed lock expires |
| `PUBLICATION_TTL_MS` | 15000 | An unrepublished route is dropped |

### Reservation algorithm

```
1. ctx  = { reservedSegments(self), occupiedWaypoints(self), selfId }
2. dest = pickDestination(robot)
3. path = planRoute(current, dest, ctx)
4. next = path[1]
5. if lockWaypoint(next, self):
       publish(self, path, next)   →  start moving
   else:
       phase = WAITING             →  yield / back off
6. on each arrival: release(current) → lock(next) → publish
```

**Liveness guarantee:** a robot that is emergency-stopped or reset mid-route releases nothing, but its locks expire after 8 s and its publication after 15 s — so the fleet routes around it with no manual cleanup.

### Simulation state machine

```
IDLE ──task──▶ MOVING ──arrive──▶ ALIGNING ──▶ PICKING_UP ──▶ MOVING
                  │                                          │
                  │ (blocked > 6 s)                          ▼
                  ▼                                       DROPPING ──▶ IDLE
               WAITING ── grant / timeout ─▶ MOVING
                  │
                  ▼
             CHARGING (low battery)   OBSTACLE (random detection)
```

### Tuning constants

| Constant | Value |
|---|---:|
| `ARRIVAL_TOL` | 0.1 |
| `MAX_SPEED` | 0.9 m/s |
| `ACCEL` | 0.4 m/s² |
| `DECEL` | 0.8 m/s² |
| `COORD_TICK_MS` | 200 (5 Hz) |
| `WAIT_TIMEOUT_MS` | 6000 |
| `REPLAN_COOLDOWN_MS` | 1500 |

---

## 📁 Project Structure

```
FleetForge/
├── docs/                      # Modular documentation
├── DOCUMENTATION.md           # This file
├── public/favicon.svg
├── src/
│   ├── App.tsx                # 146  view routing + page composition
│   ├── index.css              # 185  design system, theme, scrollbar
│   ├── main.tsx               #    9  React root
│   ├── components/
│   │   ├── analytics/         # MetricKpiGrid, DistanceChart, BatteryHealthCard
│   │   ├── common/            # AppShell, Header, Sidebar, StatusBadge, status.ts
│   │   ├── events/            # LiveEventFeed
│   │   ├── fleet/             # FleetGrid
│   │   ├── settings/          # SettingsPanel
│   │   ├── simulation/        # Controls, inspector, KPI strip, footer, modal
│   │   │   └── three/         # WarehouseScene, AMRs, racks, floor, lights
│   │   └── tasks/             # TaskQueueTable, TaskKpiRibbon
│   ├── data/                  # warehouseLayout, mockFleet, mockTasks
│   ├── engine/                # waypointGraph, routePlanner, routeRegistry, pheromoneMap
│   ├── hooks/                 # useSimulationLoop, useTaskGenerator
│   ├── store/                 # useFleetStore, useThemeStore
│   └── types/                 # fleet.ts — shared domain types
├── tailwind.config.cjs
├── tsconfig.json
└── vite.config.ts
```

### Largest files

| File | Lines | Purpose |
|---|---:|---|
| `hooks/useSimulationLoop.ts` | 505 | Coordinator + motion loop, phase machine |
| `components/simulation/TelemetryInspector.tsx` | 291 | Operator telemetry and actions |
| `components/tasks/TaskQueueTable.tsx` | 217 | Search, filter, sort, sim speed |
| `components/simulation/SimulationControls.tsx` | 201 | Command toolbar |
| `components/simulation/three/AMRs.tsx` | 190 | Robot meshes, labels, markers |
| `components/simulation/three/WarehouseFloor.tsx` | 175 | Floor, lanes, zones, pads |
| `components/common/Sidebar.tsx` | 169 | Nav + live coordinator status |
| `components/simulation/NewTaskModal.tsx` | 156 | Task creation dialog |
| `App.tsx` | 146 | View switching |
| `components/simulation/KpiStrip.tsx` | 143 | 4-metric strip with change flash |

### Data contracts

`src/types/fleet.ts` defines everything the app shares:

```ts
type RobotStatus =
  | 'IDLE' | 'MOVING_TO_PICKUP' | 'ALIGNING' | 'PICKING_UP'
  | 'CARRYING' | 'DROPPING' | 'GOING_TO_CHARGE'
  | 'OBSTACLE_DETECTED' | 'WAITING';

interface AMR {
  id; numericId; battery; status;
  position; targetPosition; speed; distanceTravelled;
  currentTask; destination; payload;
  isEmergencyStopped; color;
}

interface WarehouseTask  { id; boxId; pickupNode; dropLocation;
                           assignedRobotId; status; createdAt; }
interface SimulationEvent{ id; timestamp; robotId; message;
                           type: 'INFO'|'WARN'|'DANGER'|'SUCCESS'; }
interface WarehouseRack | Obstacle | Waypoint | DropZone | ChargingPad
```

`src/data/warehouseLayout.ts` is the **single source of truth** for the world:

```ts
export const LANES   = { x: [2,6,10,14,18], z: [2,6,10,14,18] };
export const WAYPOINTS, RACKS, OBSTACLES, CHARGING_PADS, DROP_ZONES;
export function isOnLane(x, z): boolean;
export function snapToLaneIntersection(x, z): { x; z };
```

---

## 🧩 Components

### Shell

| Component | Props | Notes |
|---|---|---|
| `AppShell` | `{ activeView, onNavigate, onLogout?, children }` | Full-height flex shell |
| `Header` | `{ onLogout }` | Brand, clock, global state chip, pause/reset |
| `Sidebar` | `{ activeView, onNavigate }` | Nav groups, active bar, live coordinator counters |
| `StatusBadge` | `{ status, size?: 'sm'\|'md' }` | Dot + normal-case label |

### Simulation

| Component | Props | Notes |
|---|---|---|
| `KpiStrip` | — | Active / Tasks / Completed / Battery |
| `SimulationControls` | `{ onNewTask, onViewModeChange, onFollowChange, onResetCamera }` | Command toolbar |
| `TelemetryInspector` | — | Identity, power, mission, telemetry, actions |
| `CanvasFooter` | `{ viewMode }` | Scene legend overlay |
| `NewTaskModal` | `{ isOpen, onClose }` | Portal dialog |

### Scene

| Component | Props | Notes |
|---|---|---|
| `WarehouseScene` | `{ viewMode, follow, resetKey }` | Canvas + controls + lights |
| `AMRs` | `{ palette }` | Chassis, labels, rings, hitboxes |
| `WarehouseFloor` | `{ palette }` | Tiles, lanes, zones, pads |
| `WarehouseRacks` | `{ palette }` | Frames, shelves, pallets, boxes |
| `Obstacles` | `{ palette }` | Cylinders with pulsing ring |
| `Lights` | `{ palette }` | Ambient + key/fill with shadows |

### Views

| Component | Props |
|---|---|
| `LiveEventFeed` | `{ variant?: 'compact'\|'full' }` |
| `TaskQueueTable` · `TaskKpiRibbon` · `FleetGrid` | none |
| `MetricKpiGrid` · `DistanceChart` · `BatteryHealthCard` · `SettingsPanel` | none |

### Robot label hierarchy

Prominence follows operational need:

1. **Selected** — solid emerald chip, id + status
2. **Needs attention** (`WAITING`, `OBSTACLE_DETECTED`, e-stop) — dark chip, tone-coloured status
3. **Moving** — dark chip, id only
4. **Idle** — low-opacity chip, id only

---

## 🪝 Hooks & State

### `useSimulationLoop()`

Mounted once in `App.tsx`. Each coordinator tick: build context → pick destination → A\* plan → acquire lock → publish → handle phase transitions → decay pheromones → sweep expired TTLs. Each frame: integrate motion along the current path.

Ref-based `RobotPhase` state per robot lives in a `useRef` map — it is *simulation* state, not UI state, so it deliberately stays out of the React store.

### `useTaskGenerator()`

```ts
MIN_INTERVAL_MS = 10_000
MAX_INTERVAL_MS = 30_000
MAX_ACTIVE_TASKS = 20
```

Schedules the first tick immediately and clears its timeout on unmount, so StrictMode double-mounting cannot leak timers.

### `useFleetStore`

| State | Type |
|---|---|
| `robots` | `AMR[]` |
| `tasks` | `WarehouseTask[]` |
| `events` | `SimulationEvent[]` |
| `obstacles` | `Obstacle[]` |
| `selectedRobotId` | `string \| null` |
| `isRunning` · `isEmergencyStopped` | `boolean` |
| `simulationSpeed` | `0.5 \| 1 \| 2 \| 5` |
| `simulationStartedAt` | `number` |
| `coordinationStats` | assignments, conflicts resolved, peak concurrent |

| Action | Signature |
|---|---|
| `selectRobot` | `(id \| null) => void` |
| `setRunning` | `(v: boolean) => void` |
| `toggleEmergencyStop` | `() => void` |
| `setSpeed` | `(0.5 \| 1 \| 2 \| 5) => void` |
| `updateRobot` | `(id, patch: Partial<AMR>) => void` |
| `addEvent` / `addTask` / `addObstacle` | insert with generated id/timestamp |
| `resetSimulation` | `() => void` — also clears registry, pheromones, phases |

### `useThemeStore`

```ts
{ theme: 'light' | 'dark'; setTheme(t); toggle() }
```

`App.tsx` syncs it to the `dark` class on `document.documentElement`.

### Selector hygiene

```tsx
// good — only re-renders when this robot changes
const robot = useFleetStore((s) => s.robots.find((r) => r.id === s.selectedRobotId));

// avoid — re-renders on every store write
const store = useFleetStore();
```

---

## 🎨 Design System

Defined in `src/index.css` under `@layer components`.

| Class | Role |
|---|---|
| `.ff-panel` | Framed tool or repeated item |
| `.ff-band` | Full-bleed band (toolbar, KPI rail) |
| `.ff-rule` | Hairline border colour |
| `.ff-label` | The **only** uppercase style — categories/system labels |
| `.ff-heading` | Section heading (13 px semibold) |
| `.ff-field-label` | Normal-case field label |
| `.ff-data` | Machine value — mono, right-aligned, tabular |
| `.ff-sub` | Secondary line under a metric |
| `.ff-control` + `-primary` / `-neutral` / `-quiet` / `-warn` / `-danger` | Buttons |
| `.ff-icon-btn` | Icon-only tool button |
| `.ff-seg` / `.ff-seg-item` / `.ff-seg-item-active` | Segmented control |
| `.ff-meter` / `.ff-meter-fill` | Tracked meter |
| `.ff-status` / `.ff-status-dot` | Dot + normal-case word |

### Radius scale (forced)

| Token | Value |
|---|---:|
| `rounded` | 3 px |
| `rounded-sm` | 4 px |
| `rounded-md` | 6 px |
| `rounded-lg` / `-xl` / `-2xl` | 8 px |

### Semantic colour

One map, `src/components/common/status.ts` — components must read from it instead of re-declaring status palettes:

| Tone | Colour | Meaning |
|---|---|---|
| `ok` | Green | Operational / active / healthy |
| `info` | Blue | Navigation / informational |
| `charge` | Cyan | Charging |
| `warn` | Amber | Warning / pending |
| `danger` | Red | Error / critical / e-stop |
| `idle` | Slate | Idle |

Exports: `TONE_HEX`, `TONE_BG`, `TONE_TEXT`, `TONE_SURFACE`, `toneOfStatus`, `toneOfBattery`, `statusLabel`, `batteryLabel`, `isActiveStatus`, `needsAttention`.

### House rules

- Uppercase only on system labels — everything an operator must *read* is normal case
- Numbers are tabular mono so columns never jitter
- Status is a dot plus a word, never a pill
- Hairline borders carry elevation; shadow is reserved for overlays
- Static class strings only — Tailwind's purge cannot see concatenation

---

## ⚙️ Configuration

### Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Dev server with HMR → http://localhost:5173 |
| `build` | `tsc && vite build` | Type-check, then emit `dist/` |
| `preview` | `vite preview` | Serve the production build |

### TypeScript

```jsonc
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"isolatedModules": true
```

| Rule | Consequence |
|---|---|
| `strict` | No implicit `any`, strict null checks |
| `noUnused*` | Unused parameters must be prefixed with `_` |
| `noFallthroughCasesInSwitch` | Every `case` needs `break` or `return` |

Additional house rules: **no `console.log/warn/error` in `src/`**, **no `any`**, **no leftover `TODO`s**.

### Tailwind

```js
darkMode: 'class',   // toggled by useThemeStore
content: ['./index.html', './src/**/*.{ts,tsx}'],
```

`package.json` declares `"type": "module"`, so every Tailwind/PostCSS config is **`.cjs`**.

### Vite

```ts
export default defineConfig({ plugins: [react()] });
```

No aliases, no proxy, no manual chunks.

---

## 📊 Performance

### Build output

| Artifact | Raw | Gzipped |
|---|---:|---:|
| `assets/index-*.js` | 1,281.55 kB | 354.69 kB |
| `assets/index-*.css` | 36.75 kB | 6.64 kB |
| `index.html` | 0.49 kB | 0.32 kB |

| Metric | Value |
|---|---|
| Modules transformed | 2,171 |
| Build wall time | ~6 s (`tsc` + `vite build`) |
| Type-check | `npx tsc --noEmit` → exit 0 in ~2 s |

The JS chunk is dominated by three.js + React Three Fiber.

### Runtime budgets

| Loop | Rate | Budget |
|---|---|---|
| Coordinator tick | 5 Hz | < 2 ms (A\* over 13 nodes) |
| Motion tick | ~30 Hz | < 0.5 ms (integration only) |
| Pheromone decay | 5 Hz | O(segments) |
| Registry sweep | 5 Hz | ≤ 13 locks, ≤ 5 publications |
| Task generation | 10–30 s | O(1) |

Planning is deliberately **not** on the 30 Hz path — it runs on the coordinator tick, on destination change, or after `WAIT_TIMEOUT_MS`, guarded by `REPLAN_COOLDOWN_MS`.

### Algorithmic complexity

| Operation | Complexity | Scale here |
|---|---|---|
| Graph build | O(n²) with O(n) between-check | n = 13 |
| `findPath` (BFS) | O(V + E) | 13 nodes |
| `planRoute` (A\*) | O(E), linear open-set | ~30 edges |
| `pheromoneMap.get/deposit` | O(1) | hash map |
| Free-cell pick | O(cells × objects) | 25 × ~30 |

### Performance gotchas

1. **Do not plan inside `applyMotion`** — it runs every frame; planning belongs on the 5 Hz tick
2. **Do not build Tailwind class names dynamically** — they silently disappear
3. **Do not select the whole store** — narrow selectors only
4. **Do not add per-frame DOM writes** — labels are React-rendered
5. **Keep the graph small** — A\*'s open-set scan is linear; swap in a heap past a few hundred nodes

---

## ✅ Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | **exit 0**, 2,171 modules, ~6 s |
| `console.log/warn/error` in `src/` | **0 matches** |
| Headless Chrome — dashboard @ 1440 / 1280 / 1024 / 768 / 430 / 390 | **0 console errors** |
| Headless Chrome — simulation @ 1440 / 800 / 390 / 430 | **0 console errors** |
| Design-system classes present in built CSS | verified (`.ff-control-primary`, `.ff-seg-item-active`, `.tracking-label`, …) |
| Waypoint graph connectivity | **13/13 nodes, 0 unreachable pairs** |
| Semantic colours routed through shared tone map | verified |

---

## 🌍 Use Cases

### 1 · Warehouse fleet operations

Centralised schedulers serialize movement; purely local controllers deadlock at junctions. FleetForge shows the middle path: each robot plans for itself with A\*, against a *shared* view of reservations and a slowly-evolving congestion signal.

**Applies to:** AMR/AGV fleets, auto-guided vehicles, port and yard tractors, airport baggage carts.

### 2 · Digital-twin prototyping

The whole world is one data file. Edit a coordinate, reload — graph, planner, renderer and placement logic all follow.

**Applies to:** pre-construction layout validation, rack re-slotting studies, safety reviews, training simulators.

### 3 · Multi-agent coordination research

Instrumentation is built in: route assignments, conflicts resolved, peak concurrent routes, corridor waits, reroutes, live lock count. Change `PHEROMONE_COST_FACTOR` or `LOCK_TTL_MS` and watch the numbers move.

### 4 · Operator interface design

Colour and typography carry meaning — one shared tone map, uppercase reserved for system labels, tabular numerals, dot-plus-word status.

### 5 · Emergency & degraded-mode handling

| Scenario | Behaviour |
|---|---|
| Global E-stop | Motion freezes; locks expire after 8 s; fleet routes around stopped units |
| Blocked > 6 s | Hard replan, backoff, `WAITING` surfaced to the operator |
| Robot removed/reset | Registry + pheromones + phases cleared, then re-bootstrapped |
| Stale plan | 15 s publication TTL drops it; nobody avoids a ghost |
| Planner returns `null` | Robot holds position instead of driving blind |

### 6 · Education & interviewing

End-to-end demonstration of React 19 + strict TypeScript, Zustand with narrow selectors, a pure algorithm layer called from hooks, declarative three.js, a tokenised CSS design system, and strict CI gates.

### Honest limitations

| Limitation | Detail |
|---|---|
| No backend | State is in-memory; a reload resets the fleet |
| No persistence | No save/load of layouts or sessions |
| No auth | Single-user, local only |
| No hardware bridge | No MQTT/OPC-UA — robots are simulated |
| Single tab | `routeRegistry` is a module singleton |
| 13-node graph | Linear open-set A\*; a bigger warehouse needs a heap |
| Settings | A few toggles are UI-only and not yet wired to the store |
| Bundle size | three.js is not yet code-split |

---

## 🔭 Roadmap

1. **Code-split** the simulation view (`React.lazy`) to shrink the initial chunk
2. **Persist** layout and session state to `localStorage`
3. **Bridge** to a real fleet via MQTT or OPC-UA behind the same `routeRegistry` interface
4. **Wire** the remaining Settings toggles to `useFleetStore`
5. **Swap** A\*'s open-set scan for a binary heap
6. **Unit-test** `engine/*` — it is already React-free and pure, so it needs no DOM harness
7. **Add a LICENSE**

---

## 📚 Documentation

This document is the consolidated reference. Modular docs live in [`docs/`](docs/README.md):

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System design, data flow, timing model, design patterns |
| [Project Structure](docs/project-structure.md) | Complete folder and file organization |
| [Features](docs/features.md) | Detailed feature documentation |
| [Components](docs/components.md) | UI components reference and props |
| [Hooks](docs/hooks.md) | Custom React hooks and store selectors |
| [Engine](docs/engine.md) | Graph, A*, pheromones, reservation registry |
| [Configuration](docs/configuration.md) | Build tooling, TypeScript, Tailwind tokens |
| [Performance](docs/performance.md) | Bundle size, build metrics, runtime budgets |
| [Use Cases](docs/use-cases.md) | Real-world benefits and limitations |

### Update convention

Each document follows: **Overview → Technical details → File references → API/props**. When making changes, update the relevant section and the table below.

| Last updated | Change |
|---|---|
| 2026-09-26 | Initial documentation set; route coordination engine and UI redesign |
| 2026-09-26 | Consolidated `DOCUMENTATION.md` |
