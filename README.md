<div align="center">
  <h1>🚛 FleetForge</h1>
  <p><strong>Autonomous Fleet Command Dashboard</strong></p>
  
  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white&style=flat-square" />
    <img alt="Three.js" src="https://img.shields.io/badge/Three.js-0.186-black?logo=three.js&logoColor=white&style=flat-square" />
    <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square" />
    <img alt="Zustand" src="https://img.shields.io/badge/Zustand-State_Management-764ABC?style=flat-square" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white&style=flat-square" />
  </p>

  <p><i>A browser-based command dashboard for supervising a fleet of AMRs (autonomous mobile robots) inside a warehouse, with a live 3D simulation, a reservation-based route coordination engine, telemetry inspector, task queue, event feed and analytics. No backend or API required—everything runs locally in your browser.</i></p>

</div>

---

## 📑 Table of Contents

- [🚀 Getting Started](#-getting-started)
- [✨ Core Features](#-core-features)
- [🧭 Architecture & State](#-architecture--state)
- [🧠 HiveMind Coordination Engine](#-hivemind-coordination-engine)
- [🎨 UI & Design System](#-ui--design-system)
- [📚 Documentation](#-documentation)
- [🏗️ Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)

---

## 🚀 Getting Started

Get FleetForge running locally in seconds. **No environment variables, no database, no backend.**

- [ ] Ensure you have **Node.js 18+** and **npm 9+** installed.
- [ ] Clone the repository and run the following:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
# -> http://localhost:5173

# 3. (Optional) Run type-checking in strict mode
npx tsc --noEmit

# 4. (Optional) Build for production
npm run build
npm run preview
```

---

## ✨ Core Features

### 🗺️ The Seven Unique Views
| View | Description |
| --- | --- |
| **Dashboard** | 11 live KPIs spanning deliveries, utilization, and distance; per-robot distance charts; and battery health indicators. |
| **3D Simulation** | Live digital twin of the warehouse with KPI strips, a command toolbar, telemetry rails, and an event log overlay. |
| **Fleet Management** | Individual AMR cards featuring live status badges and deep links to robot state. |
| **Task Management** | Complete lifecycle management with sortable, filterable queues, a KPI ribbon, and simulation speed controls. Auto-generates tasks every 10–30 seconds. |
| **Event Feed** | Full-height chronological log for all simulation events, state changes, and task completions. |
| **Analytics** | Comprehensive KPI grids, distance breakdowns, and battery utilization metrics. |
| **Settings** | Configuration for UI appearance (Light/Dark themes) and simulation preferences. |

### 🧊 3D Simulation & Environment
- **Scale:** 20 × 20 m warehouse mapped on a 4 m lane grid.
- **Topology:** 13 interconnected waypoints, 8 storage racks (2×4 layout), 2 charging pads, 2 drop zones, and 4 dynamic obstacles.
- **AMR Digital Twin:** 5 robots precisely rendered with a chassis, wheels, heading cone, payload box, selection rings, and floating ID labels.
- **Controls:** Fully interactive Orbit / pan / zoom camera. Includes **Top View** and **3D View** toggles, a follow-selected-robot mode, camera resets, and fullscreen mode.
- **Interaction:** Click an AMR to select it and view its isolated telemetry; click the floor to deselect.

---

## 🧭 Architecture & State

The application is structured into five distinct layers to ensure optimal performance and maintainability:

1. **VIEW (React 19):** `App.tsx` → `AppShell` → Page Components.
2. **STATE (Zustand):** `useFleetStore` (robots, tasks, events, flags) and `useThemeStore` (light/dark).
3. **SIMULATION:** `useSimulationLoop` drives a 5 Hz coordinator and a ~30 Hz motion tick. `useTaskGenerator` continuously produces tasks.
4. **ENGINE:** Pure TypeScript logic operating outside of React (`waypointGraph`, `routePlanner`, `routeRegistry`, `pheromoneMap`).
5. **SCENE (Three.js/R3F):** High-performance rendering of the `WarehouseScene`, AMRs, lights, and layout.

### Strict Data Flow
**Single Source of Truth:** Components never mutate robot state directly. The simulation loop is the sole writer during normal execution. Operator commands dispatch explicit actions to `useFleetStore`.
- React components subscribe to `useFleetStore`.
- The R3F scene directly reads positions and renders—it writes nothing back to the store.

### Cadence & Timing Model
| Process | Rate | Description |
|---|---|---|
| **Coordinator Tick** | 5 Hz | Picks destinations, plans routes (A*), publishes locks, handles waiting/timeouts. |
| **Motion Tick** | ~30 Hz | Accelerates/decelerates, integrates kinematics, drains battery based on load. |
| **Pheromone Decay** | 5 Hz | Evaporates trail congestion at a rate of 8% per second. |
| **Task Generator** | 10–30 s | Generates randomized tasks if the queue drops below 20. |

---

## 🧠 HiveMind Coordination Engine

The coordination engine sits at the heart of FleetForge, ensuring collision-free routing without deadlocks. It relies on four major, testable components:

### 1. Waypoint Graph
Adjacency is derived directly from the lane grid (`LANE_STEP = 4`). It calculates connectivity (13/13 reachable nodes) so robots can seamlessly traverse the warehouse.

### 2. A\* Pathfinding Planner
An A* planner dynamically avoids congestion. The cost to travel an edge factors in distance, active pheromones, reserved segments, and occupied nodes:
```text
edgeCost = distance * (1 + pheromone * 6.0) 
         + 100 (if segment reserved) 
         + 50 (if waypoint occupied)
```
The Euclidean heuristic remains admissible, making the planner eager to detour around heavy traffic.

### 3. Pheromone Cost Field (Ant-Colony Inspired)
Robots deposit "pheromones" as they move. The field naturally decays (8% per second). Both travel directions share the same field map, naturally dispersing traffic over time instead of robots piling up in the same corridor.

### 4. Reservation Registry & Auto-Expiry
Robots lock waypoints to guarantee exclusive access. 
- **Time-to-Live (TTL):** Unrefreshed locks expire after 8,000ms. Unrepublished routes drop after 15,000ms.
- **Emergency Liveness:** If an AMR hits an Emergency Stop, its locks expire, and the rest of the fleet routes around it automatically—preventing total system gridlock.

### Simulation State Machine
```text
IDLE ──task──▶ MOVING ──arrive──▶ ALIGNING ──▶ PICKING_UP ──▶ MOVING
                  │                                          │
                  │ (blocked > 6 s)                          ▼
                  ▼                                       DROPPING ──▶ IDLE
               WAITING ── grant / timeout ─▶ MOVING
```

---

## 🎨 UI & Design System

- **Thematic Consistency:** Deeply integrated Light and Dark modes. The theme store simultaneously updates Tailwind CSS classes and the Three.js scene environment maps.
- **Design Tokens:** Strict `3/4/6/8 px` border-radius scale enforced throughout all components.
- **Responsiveness:** A collapsing sidebar, fluid KPI grids, and HUD-style graphical overlays ensure the dashboard works across screen sizes.
- **Semantic Colors:** A single tone map (`status.ts`) synchronizes standard colors (e.g., Idle=Blue, Moving=Green, Error=Red) across DOM elements and 3D materials.

---

## 📚 Documentation

**[DOCUMENTATION.md](DOCUMENTATION.md)** is the consolidated reference for the entire project.
📚 **[Read the full documentation →](https://anmay-ballarpure.mintlify.app)**

Modular documentation is available in the `docs/` folder:

- 🏗️ **[Architecture](docs/architecture.md)** — System design, data flow, and timing models.
- 📂 **[Project Structure](docs/project-structure.md)** — Complete file and folder organization.
- ✨ **[Features](docs/features.md)** — Detailed breakdown of every feature.
- 🧩 **[Components](docs/components.md)** — UI components reference and props.
- 🪝 **[Hooks](docs/hooks.md)** — Custom React hooks and state selectors.
- ⚙️ **[Engine](docs/engine.md)** — Waypoint graph, A*, pheromones, and reservation logic.
- 🛠 **[Configuration](docs/configuration.md)** — Build tooling and Tailwind configuration.
- ⚡ **[Performance](docs/performance.md)** — Bundle size and runtime budgets.
- 💡 **[Use Cases](docs/use-cases.md)** — Real-world application benefits and limitations.

---

## 🏗️ Project Structure

```text
src/
├── App.tsx                  # Application shell and view routing
├── components/              # UI Components
│   ├── analytics/           # KPI Grids, Charts
│   ├── common/              # AppShell, Navigation, Status Badges
│   ├── events/              # Event Feeds
│   ├── fleet/               # Robot Cards & Grid
│   ├── settings/            # Preference Toggles
│   ├── simulation/          # 3D Scene Controls & Overlays
│   │   └── three/           # Three.js Racks, Floor, AMR models
│   └── tasks/               # Task Queues
├── data/                    # Mock data for fleet and tasks
├── engine/                  # Core logic: Pathfinding, Pheromones, Registry
├── hooks/                   # Custom Hooks (Simulation Loop, Generators)
├── store/                   # Zustand Stores (Fleet state, Theme state)
└── types/                   # TypeScript Interfaces and Types
```

---

## 🛠️ Tech Stack

Everything runs entirely in the browser using the latest modern web technologies:

- **Core:** [React 19](https://react.dev/) and [TypeScript 5](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 5](https://vitejs.dev/)
- **Styling:** [Tailwind CSS 3](https://tailwindcss.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **3D Rendering:** [Three.js](https://threejs.org/) with [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) and [Drei](https://github.com/pmndrs/drei)
- **Icons & Typography:** [Lucide React](https://lucide.dev/) and [Inter Font](https://rsms.me/inter/)

---
<p align="center">Built for <b>Smart India Hackathon 2026</b></p>
