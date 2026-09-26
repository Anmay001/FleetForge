# FleetForge — Documentation

**Autonomous Fleet Command** — a browser-based command dashboard for supervising a fleet of AMRs (autonomous mobile robots) inside a warehouse, with a live 3D simulation, a reservation-based route coordination engine, a telemetry inspector, task queue, event feed and analytics.

Built with React 19, TypeScript, three.js / React Three Fiber, Zustand and Tailwind CSS. No backend, no API keys — the whole fleet simulation runs in the browser.

## Quick links

> **Single-file reference:** [`DOCUMENTATION.md`](../DOCUMENTATION.md) in the repository root.

| Document | Description |
| --- | --- |
| [Architecture](architecture.md) | System design, data flow, timing model, design patterns |
| [Project Structure](project-structure.md) | Complete folder and file organization with line counts |
| [Features](features.md) | Detailed feature documentation |
| [Components](components.md) | UI components reference and props |
| [Hooks](hooks.md) | Custom React hooks and store selectors |
| [Engine](engine.md) | Route coordination: graph, A*, pheromones, reservation registry |
| [Configuration](configuration.md) | Build tooling, TypeScript strictness, Tailwind tokens, scripts |
| [Performance](performance.md) | Bundle size, build metrics and runtime budgets |
| [Use Cases](use-cases.md) | Real-world application benefits |

## Technology stack

### Frontend

| Layer | Choice |
| --- | --- |
| Framework | React 19 (Vite 5, App-free single-page) |
| Language | TypeScript 5 (`strict`, `noUnusedLocals`, `noUnusedParameters`) |
| Styling | Tailwind CSS 3 + custom `@layer components` design system |
| Icons | lucide-react |
| Fonts | Inter (`@fontsource-variable/inter`) |
| Class utils | `clsx`, `tailwind-merge` |

### Simulation & 3D

| Layer | Choice |
| --- | --- |
| 3D engine | three.js 0.186 |
| React renderer | @react-three/fiber 9 |
| Helpers | @react-three/drei (OrbitControls, Html) |
| Routing | Hand-rolled waypoint graph + A* + pheromone cost field |
| Coordination | In-process reservation registry with waypoint locks |

### State

| Layer | Choice |
| --- | --- |
| Global store | Zustand 4 (`useFleetStore`, `useThemeStore`) |
| Server / API | none — fully client-side |

## Core features

### 1. 3D Warehouse Simulation

A 20 × 20 m floor with 8 racks, 2 charging pads, 2 drop zones, 4 obstacles and 13 waypoints, rendered with React Three Fiber. Orbit/pan/zoom camera, Top and 3D view modes, follow-selected-robot, camera reset and fullscreen.

### 2. Route Coordination Engine

Waypoint graph → A* with a pheromone cost field → reservation registry with waypoint locks. Robots publish their routes, lock the waypoint they are entering, and republish when they move — so two AMRs never commit to the same node. See [Engine](engine.md).

### 3. Telemetry Inspector

Select any AMR to read its status, battery health bar, current task, destination, live position, speed and distance travelled, with operator actions: Stop, Pause, Resume, Reroute, Send to charging pad, Emergency stop and Bring all units online.

### 4. Task Management

Sortable, filterable, searchable task queue with a KPI ribbon (queued / in progress / completed). Tasks are auto-generated every 10–30 s, capped at 20 active, or created manually from the command toolbar.

### 5. Live Event Feed

Chronological log of simulation events with severity-typed rows (INFO / WARN / DANGER / SUCCESS), colour-coded source robot, and a compact collapsible variant inside the simulation rail.

### 6. Fleet Management

Per-robot cards with live status badges, battery meter, distance, speed, current task and destination — click a card to select that unit everywhere in the app.

### 7. Analytics & Dashboard

KPI grid (deliveries, utilisation, battery, distance, obstacle events, reroutes, corridor waits, route assignments, conflicts resolved, peak concurrency), distance-per-robot bars and battery health over simulation uptime.

### 8. Theme & Settings

Light-first with `dark:` variants throughout, driven by `useThemeStore`. Settings panel exposes appearance, simulation and display preferences.

## Getting started

### Prerequisites

- Node.js 18+
- npm (or yarn / pnpm)

That is all — there is no database, no API server and no environment file to configure.

### Installation

```bash
# Clone the repository
git clone https://github.com/Anmay001/FleetForge.git
cd FleetForge

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Available scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR → http://localhost:5173 |
| `npm run build` | Type-check with `tsc` then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

### Accessing the application

| Surface | URL |
| --- | --- |
| Dev server | http://localhost:5173 |
| Production build | `dist/` (static, any file server or Netlify) |
| Deployed site | GitHub `main` → Netlify continuous deployment |

## Environment variables

**None required.** FleetForge has no secrets, no third-party API keys and no backend endpoints.

| Variable | Description | Required |
| --- | --- | --- |
| — | No environment variables are read by the application | — |

If you later add telemetry export or an auth layer, keep server-side secrets out of the Vite bundle: anything prefixed `VITE_` is inlined into the client JavaScript and is public.

## Project structure overview

```
FleetForge/
├── docs/                      # Documentation (you are here)
├── public/                    # Static assets (favicon.svg)
├── src/
│   ├── App.tsx                # View routing + page composition
│   ├── index.css              # Design system (.ff-* classes)
│   ├── main.tsx               # React entry point
│   ├── components/
│   │   ├── analytics/         # MetricKpiGrid, DistanceChart, BatteryHealthCard
│   │   ├── common/            # AppShell, Header, Sidebar, StatusBadge, status.ts
│   │   ├── events/            # LiveEventFeed
│   │   ├── fleet/             # FleetGrid
│   │   ├── settings/          # SettingsPanel
│   │   ├── simulation/        # Controls, inspector, KPI strip, footer, modal
│   │   │   └── three/         # WarehouseScene, AMRs, racks, floor, lights
│   │   └── tasks/             # TaskQueueTable, TaskKpiRibbon
│   ├── data/                  # Warehouse layout, mock fleet, mock tasks
│   ├── engine/                # Graph, A*, pheromones, reservation registry
│   ├── hooks/                 # useSimulationLoop, useTaskGenerator
│   ├── store/                 # useFleetStore, useThemeStore (Zustand)
│   └── types/                 # Shared domain types
├── index.html
├── tailwind.config.cjs
├── tsconfig.json
└── vite.config.ts
```

See [Project Structure](project-structure.md) for a per-file breakdown.

## Documentation updates

This documentation is structured for easy updates. Each document follows a consistent format:

1. **Overview** — high-level description of the area
2. **Technical details** — implementation specifics
3. **File references** — source code locations
4. **API / props** — interface documentation

When making changes, update the relevant document section and add the date.

| Last updated | Change |
| --- | --- |
| 2026-09-26 | Initial documentation set; route coordination engine and UI redesign |
