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

  <p><i>A browser-based command dashboard for supervising a fleet of AMRs (autonomous mobile robots) inside a warehouse, with a live 3D simulation, a reservation-based route coordination engine, telemetry inspector, task queue, event feed and analytics.</i></p>

</div>

---

## 📑 Table of Contents

- [🚀 Getting Started](#-getting-started)
- [✨ Features](#-features)
- [📚 Documentation](#-documentation)
- [🏗️ Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)

---

## 🚀 Getting Started

<details>
<summary><b>Click to expand Installation & Setup instructions</b></summary>
<br/>

Get FleetForge running locally in seconds. No environment variables or external services required.

- [ ] Ensure you have Node.js 18+ and npm 9+ installed.
- [ ] Clone the repository or navigate to the project directory.
- [ ] Run the following commands:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
# The app will be available at http://localhost:5173

# 3. (Optional) Run type-checking
npx tsc --noEmit

# 4. (Optional) Build for production
npm run build
npm run preview
```
</details>

---

## ✨ Features

<details>
<summary><b>Click to explore the core features</b></summary>
<br/>

### 🗺️ The Seven Views
| View | Description |
| --- | --- |
| **Dashboard** | 11 KPIs, distance-per-robot bars, battery health |
| **3D Simulation** | KPI strip, command toolbar, live warehouse scene, telemetry rail, event log |
| **Fleet Management** | Per-robot cards with live status badges |
| **Task Management** | KPI ribbon + sortable, filterable task queue + sim-speed control |
| **Event Feed** | Full-height log of simulation events |
| **Analytics** | KPI grid, distance-per-robot bars, battery health |
| **Settings** | Theme and preference toggles |

### 🧊 3D Simulation
- **Environment:** 20 × 20 m warehouse on a 4 m lane grid with racks, charging pads, drop zones, and dynamic obstacles.
- **AMRs:** 5 robots rendered with chassis, wheels, heading cone, payload box, selection ring, and floating ID labels.
- **Camera Controls:** Orbit / pan / zoom camera, **Top View** and **3D View** modes, follow-selected-robot.
- **Interaction:** Click a robot to select it; click empty floor to deselect.

### 🧠 Route Coordination Engine
- Waypoint graph built from the lane grid.
- A\* pathfinding with a pheromone cost field, segment reservations, and occupied-waypoint penalties.
- Reservation registry with TTL waypoint locks, ensuring AMRs never collide.
- Auto-expiring locks prevent the fleet from stalling in emergencies.

### 🤖 Fleet State Machine
```text
IDLE → MOVING → ALIGNING → PICKING_UP → CARRYING → DROPPING → IDLE
                  ↘ WAITING          ↘ CHARGING   ↘ OBSTACLE
```
- Real-time motion loop (~30 Hz) with acceleration / deceleration, battery drain, and distance tracking.
- Interactive operator commands: Stop, Pause, Resume, Reroute, Charge, global Emergency Stop.

### 🎨 UI & Design
- Beautiful Light and Dark modes with a semantic color palette.
- Design system driven by Tailwind CSS and custom tokens.
- Fully responsive sidebar and HUD-style overlays.

</details>

---

## 📚 Documentation

<details open>
<summary><b>Comprehensive guides and technical deep-dives</b></summary>
<br/>

**[DOCUMENTATION.md](DOCUMENTATION.md)** is the consolidated reference for the entire project.

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

</details>

---

## 🏗️ Project Structure

<details>
<summary><b>Click to view source code organization</b></summary>
<br/>

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

</details>

---

## 🛠️ Tech Stack

<details>
<summary><b>Click to expand technology stack details</b></summary>
<br/>

Everything runs entirely in the browser using the latest modern web technologies:

- **Core:** [React 19](https://react.dev/) and [TypeScript 5](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 5](https://vitejs.dev/)
- **Styling:** [Tailwind CSS 3](https://tailwindcss.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **3D Rendering:** [Three.js](https://threejs.org/) with [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) and [Drei](https://github.com/pmndrs/drei)
- **Icons & Typography:** [Lucide React](https://lucide.dev/) and [Inter Font](https://rsms.me/inter/)

</details>

---
<p align="center">Built for <b>Smart India Hackathon 2026</b></p>
