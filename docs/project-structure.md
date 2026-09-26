# Project Structure

```
FleetForge/
├── docs/                          # Documentation (you are here)
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx                    # 146  view routing + page composition
│   ├── index.css                  # 185  design system (.ff-*), theme, scrollbar
│   ├── main.tsx                   #    9  React root
│   ├── components/
│   │   ├── analytics/             # KPIs and charts
│   │   ├── common/                # App shell + shared primitives
│   │   ├── events/                # Event log
│   │   ├── fleet/                 # Fleet management
│   │   ├── settings/              # Settings panel
│   │   ├── simulation/            # Simulation controls & overlays
│   │   │   └── three/             # React Three Fiber scene
│   │   └── tasks/                 # Task queue
│   ├── data/                      # Static world + seed data
│   ├── engine/                    # Pure coordination engine (no React)
│   ├── hooks/                     # Simulation & generation loops
│   ├── store/                     # Zustand stores
│   └── types/                     # Shared domain types
├── index.html
├── package.json
├── postcss.config.cjs
├── tailwind.config.cjs
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## `src/` — file by file

Numbers are physical line counts.

### Root

| File | Lines | Purpose |
| --- | ---: | --- |
| `App.tsx` | 146 | Holds `view`, `viewMode`, `follow`, `cameraResetKey`, `isModalOpen`. Mounts `useSimulationLoop()` and `useTaskGenerator()` once, renders `AppShell` and switches on `view`. |
| `index.css` | 185 | Tailwind entry, Inter import, theme body colours, scrollbar, tabular-nums rule, and the `@layer components` design system. |
| `main.tsx` | 9 | `createRoot(...).render(<StrictMode><App/></StrictMode>)`. |

### `components/common/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `AppShell.tsx` | 23 | Full-height flex shell: `Header` on top, `Sidebar` + `<main>` below. |
| `Header.tsx` | 124 | Brand, live clock, global RUNNING/PAUSED/E-STOP chip, pause/reset, user. |
| `Sidebar.tsx` | 169 | Nav groups (Monitoring / System), active bar, responsive `w-60` ↔ `w-16`, live coordinator counters. |
| `StatusBadge.tsx` | 31 | Dot + normal-case status text driven by the shared tone map. |
| `status.ts` | 98 | **Design tokens for colour**: `Tone`, `TONE_HEX`, `TONE_BG`, `TONE_TEXT`, `TONE_SURFACE`, `toneOfStatus`, `toneOfBattery`, `statusLabel`, `batteryLabel`, `needsAttention`, `isActiveStatus`. |

### `components/simulation/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `KpiStrip.tsx` | 143 | Flat 4-metric strip: Active / Tasks / Completed / Battery, with change-flash. |
| `SimulationControls.tsx` | 201 | Command toolbar: Pause·Reset, New task·Add obstacle, Top/3D, Follow, camera reset, fullscreen. Includes free-cell picking for obstacles. |
| `TelemetryInspector.tsx` | 291 | Identity + status, unit selector, Power/Mission/Telemetry blocks, operator actions, emergency controls. |
| `LiveEventFeed` → `components/events/` | | |
| `CanvasFooter.tsx` | 54 | Scene legend overlay + obstacle count + camera hint. |
| `NewTaskModal.tsx` | 156 | Portal modal to create a task (box, pickup, drop, robot). |

### `components/simulation/three/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `WarehouseScene.tsx` | 116 | Canvas, camera rig, OrbitControls, lighting, floor/racks/AMRs/obstacles, view mode + follow + reset key. |
| `AMRs.tsx` | 190 | Chassis, wheels, heading cone, payload, selection ring, destination ring, emergency dot, click hitbox, floating labels. |
| `WarehouseFloor.tsx` | 175 | Checkerboard tiles, lane lines, grid, drop zones, charging pads. |
| `WarehouseRacks.tsx` | 112 | Rack frames, shelves, pallets, boxes. |
| `Obstacles.tsx` | 62 | Cylinder obstacles with pulsing highlight. |
| `Lights.tsx` | 35 | Ambient + directional key/fill with shadows. |
| `constants.ts` | 49 | `GRID_SIZE`, `ScenePalette`, `PALETTES.light/dark`. |

### Other component folders

| File | Lines | Purpose |
| --- | ---: | --- |
| `events/LiveEventFeed.tsx` | 132 | Compact (rail) and full (Event Feed view) variants. |
| `tasks/TaskQueueTable.tsx` | 217 | Search, status filter, sortable columns, sim-speed segmented control. |
| `tasks/TaskKpiRibbon.tsx` | 34 | Queued / In progress / Completed hairline strip. |
| `fleet/FleetGrid.tsx` | 94 | Robot cards with status badge and battery/distance/speed rows. |
| `analytics/MetricKpiGrid.tsx` | 94 | 11 dashboard/analytics KPIs. |
| `analytics/DistanceChart.tsx` | 40 | Distance-per-robot bars. |
| `analytics/BatteryHealthCard.tsx` | 63 | Per-robot battery meters + simulation uptime. |
| `settings/SettingsPanel.tsx` | 133 | Appearance / Simulation / Display / About sections. |

### `engine/` — pure TypeScript, no React

| File | Lines | Purpose |
| --- | ---: | --- |
| `waypointGraph.ts` | 121 | Builds `WAYPOINT_GRAPH` from `WAYPOINTS`; `findPath` (BFS), `snapToWaypoint`. |
| `routePlanner.ts` | 128 | `planRoute` (A*), `PlannerContext`, `edgeCost`, `validateLaneAlignment`. |
| `routeRegistry.ts` | 129 | Singleton: route publications, waypoint locks with TTLs, occupancy queries. |
| `pheromoneMap.ts` | 55 | Singleton cost field: `deposit`, `get`, `decay`, `segmentKey`. |

### `hooks/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `useSimulationLoop.ts` | 505 | The simulation: 5 Hz coordinator + 30 Hz motion, phase machine, reservations, battery, events. |
| `useTaskGenerator.ts` | 66 | Schedules task creation every 10–30 s while active < 20. |

### `store/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `useFleetStore.ts` | 89 | All simulation state and intent actions. |
| `useThemeStore.ts` | 12 | `theme`, `setTheme`, `toggle`. |

### `data/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `warehouseLayout.ts` | 85 | **Source of truth** for `LANES`, `WAYPOINTS`, `RACKS`, `OBSTACLES`, `CHARGING_PADS`, `DROP_ZONES`, `isOnLane`, `snapToLaneIntersection`. |
| `mockFleet.ts` | 43 | 5 seed AMRs with colours and batteries. |
| `mockTasks.ts` | 75 | Seed task queue. |

### `types/`

| File | Lines | Purpose |
| --- | ---: | --- |
| `fleet.ts` | 47 | `RobotStatus`, `AMR`, `WarehouseTask`, `SimulationEvent`, `WarehouseRack`, `Obstacle`, `Waypoint`, `DropZone`, `ChargingPad`. |

## Conventions

- Component files export **one default component** plus optional named helpers.
- Unused parameters are prefixed with `_` (`noUnusedParameters`).
- No `console.log/warn/error` anywhere in `src/`.
- No `any`.
- Tailwind and PostCSS configs are `.cjs` because `package.json` declares `"type": "module"`.
- Class strings passed through variables must stay **static literals** so Tailwind's purge can see them.
