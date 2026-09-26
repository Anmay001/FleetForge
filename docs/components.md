# Components

All components are function components with a default export. Props are declared as exported `…Props` interfaces.

---

## Shell

### `AppShell`

`src/components/common/AppShell.tsx`

```ts
export interface AppShellProps {
  activeView: View;
  onNavigate: (v: View) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}
```

Full-viewport flex column: `Header`, then `Sidebar` + `<main>`. `main` is `flex-1 overflow-auto`.

### `Header`

`src/components/common/Header.tsx`

```ts
export interface HeaderProps { onLogout: () => void; }
```

Brand mark, ticking clock (`HH:MM:SS - DD Mon YYYY`), global simulation-state chip (`Running` / `Paused` / `E-stop`), pause/resume, reset, user. Polls `isRunning`, `isEmergencyStopped`, `resetSimulation`.

### `Sidebar`

`src/components/common/Sidebar.tsx`

```ts
export type View =
  | 'dashboard' | 'simulation' | 'fleet' | 'tasks'
  | 'events' | 'analytics' | 'settings';

export interface SidebarProps {
  activeView: View;
  onNavigate: (v: View) => void;
}
```

Two nav groups (Monitoring, System). Wide (≥1280 px) shows labels and a **Coordinator** status block polling `routeRegistry.lockCount()`, `routeRegistry.reservedSegments().size` and `WAYPOINT_GRAPH` node count every second; narrow collapses to a pulsing status dot.

---

## Shared primitives

### `StatusBadge`

`src/components/common/StatusBadge.tsx`

```ts
export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}
```

Renders `<status dot><normal-case label>`. Tone comes from `toneOfStatus`; `OBSTACLE_DETECTED`, `DANGER` and `WARN` pulse the dot. No pill background — deliberate, so a table of badges stays quiet.

### `status.ts` (not a component — shared tokens)

`src/components/common/status.ts`

```ts
export type Tone = 'ok' | 'info' | 'charge' | 'warn' | 'danger' | 'idle';

export const TONE_HEX:     Record<Tone, string>;  // three.js / inline styles
export const TONE_BG:      Record<Tone, string>;  // Tailwind bg-*  (purge-safe)
export const TONE_TEXT:    Record<Tone, string>;  // Tailwind text-*
export const TONE_SURFACE: Record<Tone, string>;  // tinted badge surface

export function toneOfStatus(status: string): Tone;
export function toneOfBattery(percent: number): Tone;
export function statusLabel(status: string): string;   // MOVING_TO_PICKUP → "Moving to pickup"
export function batteryLabel(percent: number): string; // Healthy | Low | Critical
export function isActiveStatus(status: string): boolean;
export function needsAttention(status: string, isEmergencyStopped: boolean): boolean;
```

> Any component that needs a status colour must read from here. Do not re-declare status maps.

---

## Simulation

### `KpiStrip`

`src/components/simulation/KpiStrip.tsx` — no props.

Reads `robots`, `tasks`, `isEmergencyStopped`. Internal `useFlash(value)` tints a cell for 700 ms when its value changes.

### `SimulationControls`

```ts
export interface SimulationControlsProps {
  onNewTask: () => void;
  onViewModeChange: (mode: '3d' | 'top') => void;
  onFollowChange: (follow: boolean) => void;
  onResetCamera: () => void;
}
```

Owns local `viewMode` (initial `'3d'`, kept in sync with `App`) and `follow`. Exposes `pickFreeCell(robots, obstacles)` internally for obstacle placement.

### `TelemetryInspector`

`src/components/simulation/TelemetryInspector.tsx` — no props.

Reads `robots`, `selectedRobotId` (falls back to the first robot, and renders an empty state if there are none).

### `CanvasFooter`

```ts
export interface CanvasFooterProps { viewMode: '3d' | 'top'; }
```

Absolute bottom scrim with legend (hidden below `sm`), obstacle count, and a camera hint (hidden below `md`).

### `NewTaskModal`

```ts
export interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

`createPortal` dialog; validated submit calls `addTask`.

---

## Scene (`components/simulation/three/`)

### `WarehouseScene`

```ts
export interface WarehouseSceneProps {
  viewMode: '3d' | 'top';
  follow: boolean;
  resetKey: number;
}
```

Composes lights, floor, racks, obstacles, AMRs and controls. `resetKey` increments to force the camera to its initial pose.

### `AMRs`

```ts
export interface AMRsProps { palette: ScenePalette; }
```

Renders every robot in the store. Internal `RobotLabel({ robot, isSelected })` implements the label hierarchy.

### `WarehouseFloor`, `WarehouseRacks`, `Obstacles`, `Lights`

No external props (or palette only). Purely presentational, driven by `data/warehouseLayout.ts`.

### `constants.ts`

```ts
export const GRID_SIZE = 20;
export interface ScenePalette {
  floor; floorAlt; gridLine; laneLine;
  dropZone; dropZoneBorder; chargingPad; chargingBorder;
  rackMetal; rackWood; box; obstacle; bg;
}
export const PALETTES: Record<'light' | 'dark', ScenePalette>;
```

---

## Views

| Component | File | Props |
| --- | --- | --- |
| `LiveEventFeed` | `events/LiveEventFeed.tsx` | `{ variant?: 'compact' \| 'full' }` |
| `TaskQueueTable` | `tasks/TaskQueueTable.tsx` | none |
| `TaskKpiRibbon` | `tasks/TaskKpiRibbon.tsx` | none |
| `FleetGrid` | `fleet/FleetGrid.tsx` | none |
| `MetricKpiGrid` | `analytics/MetricKpiGrid.tsx` | none |
| `DistanceChart` | `analytics/DistanceChart.tsx` | none |
| `BatteryHealthCard` | `analytics/BatteryHealthCard.tsx` | none |
| `SettingsPanel` | `settings/SettingsPanel.tsx` | none |

---

## Design system classes

Defined in `src/index.css` under `@layer components`. Use these instead of re-typing utilities.

| Class | Role |
| --- | --- |
| `.ff-panel` | Framed tool or repeated item (border, 8 px radius) |
| `.ff-band` | Full-bleed band inside the workspace (toolbar, KPI rail) |
| `.ff-rule` | Hairline border colour |
| `.ff-label` | The **only** uppercase style — categories and system labels |
| `.ff-heading` | Section heading inside a panel (13 px semibold) |
| `.ff-field-label` | Normal-case field label |
| `.ff-data` | Machine value (mono, right-aligned, tabular) |
| `.ff-sub` | Secondary line under a metric |
| `.ff-control` + `-primary` / `-neutral` / `-quiet` / `-warn` / `-danger` / `-danger-active` | Buttons |
| `.ff-icon-btn` | Icon-only tool button |
| `.ff-seg` / `.ff-seg-item` / `.ff-seg-item-active` | Segmented control |
| `.ff-meter` / `.ff-meter-fill` | Tracked meter (battery, distance) |
| `.ff-status` / `.ff-status-dot` | Dot + normal-case word |

**Radius scale** (forced in `tailwind.config.cjs`): `rounded` 3 px · `rounded-sm` 4 px · `rounded-md` 6 px · `rounded-lg`/`-xl`/`-2xl` 8 px.
