# Features

Seven views, one shell. Navigation is the sidebar; `App.tsx` switches on the active `View`.

| View | Route id | What it shows |
| --- | --- | --- |
| Dashboard | `dashboard` | 11 KPIs, distance-per-robot bars, battery health |
| 3D Simulation | `simulation` | KPI strip, command toolbar, live warehouse scene, telemetry rail, event log |
| Fleet Management | `fleet` | Per-robot cards with live status badges |
| Task Management | `tasks` | KPI ribbon, sim-speed control, sortable/filterable queue |
| Event Feed | `events` | Full-height chronological log |
| Analytics | `analytics` | Same KPI grid + charts as Dashboard |
| Settings | `settings` | Appearance, simulation and display preferences |

---

## 1. 3D warehouse simulation

**Files:** `components/simulation/three/*`, `data/warehouseLayout.ts`

A 20 × 20 m floor laid out on a 4 m lane grid.

| Element | Count | Notes |
| --- | ---: | --- |
| Lanes | 5 × 5 | `LANES.x = LANES.z = [2, 6, 10, 14, 18]` |
| Waypoints | 13 | 2 charging, 2 drop, 8 rack approach, 1 centre hub |
| Racks | 8 | 2 × 2 m footprints, 4 shelves each, in two rows |
| Charging pads | 2 | Corners (2,2) and (2,18) |
| Drop zones | 2 | 3 × 3 m at (17,1) and (17,17) |
| Obstacles | 4 | Cell interiors, off every lane (plus operator-placed) |
| AMRs | 5 | `AMR-01` … `AMR-05`, each with a distinct colour |

**Camera & interaction**

- Orbit / pan / zoom via OrbitControls
- **Top** and **3D** view modes (segmented control in the toolbar)
- **Follow** — keeps the camera on the selected unit
- Camera reset and fullscreen
- Click a robot to select it; click empty floor to deselect
- The selected unit shows a blue destination ring at its current target

**Visual states**

- Payload box appears while carrying
- Heading cone points along the direction of travel
- Selection ring under the selected unit
- Pulsing red dot while emergency-stopped
- Four-tier floating label: selected (solid) → needs-attention (status shown) → mover (id) → idle (id, dimmed)
- Light and dark palettes driven by the same theme store as the UI

---

## 2. Route coordination engine

**Files:** `src/engine/*` — detailed in [Engine](engine.md)

- **Waypoint graph** built once at module load; two nodes are adjacent only if they share an axis and are an exact lane step (4 m) apart with nothing in between.
- **A\*** with a Euclidean heuristic and three penalties: pheromone congestion, segments reserved by others, waypoints occupied by others.
- **Pheromone cost field** — each traversal deposits `0.35`, decaying 8 %/s, so the fleet naturally spreads across lanes.
- **Reservation registry** — robots publish routes and lock the waypoint they are entering (8 s TTL). Locks and publications expire automatically.
- **Graph validation** — `validateLaneAlignment()` confirms every neighbour sits on a real lane.

---

## 3. Telemetry inspector

**File:** `components/simulation/TelemetryInspector.tsx`

| Block | Contents |
| --- | --- |
| Identity | Robot colour dot, id, live status (`E-stop` overrides), 5-unit selector with status dots |
| Power | Battery percentage, tone, meter |
| Mission | Current task, destination, payload (when carrying) |
| Telemetry | Position X/Z, speed, distance travelled |
| Actions | Stop, Pause, Resume, Reroute (2×2), Send to charging pad (full width) |
| Emergency | Emergency stop / Resume operations, Bring all units online |

Actions write through `updateRobot(id, patch)` and append an operator event where relevant.

---

## 4. Command toolbar

**File:** `components/simulation/SimulationControls.tsx`

```
[ Pause/Resume primary ][ Reset quiet ] │ [ New task ][ Add obstacle ]
                                        │ [ Top | 3D ] [ Follow ] [ camera ][ fullscreen ]
```

- **Add obstacle** picks a genuinely free cell: it rejects out-of-bounds points, lane centres, rack footprints, charging pads, drop zones, existing obstacles and AMRs. It silently no-ops when the warehouse is full.
- Dividers group state controls from actions and view controls.

---

## 5. KPI strip

**File:** `components/simulation/KpiStrip.tsx`

| Metric | Value | Secondary line |
| --- | --- | --- |
| Active | `active / total` | `1 charging · 2 idle`, or `All units engaged` |
| Tasks | in progress | `n queued` |
| Completed | completed count | `n total tasks` |
| Battery | fleet average | `Healthy/ Low/ Critical · n charging` |

Active and Battery carry a semantic dot. A value change flashes a subtle emerald background for 700 ms. Four columns on desktop, two on mobile; secondary lines hide below `sm`.

---

## 6. Task management

**Files:** `components/tasks/*`, `hooks/useTaskGenerator.ts`

- Auto-generated every **10–30 s**, capped at **20 active** tasks
- Manual creation via **New task** (box id, pickup, drop, robot)
- Search across task id, box id and assigned robot
- Status filter: All / Queued / Moving to Pickup / Moving to Drop / Completed
- Sortable columns: task, box, pickup, drop, robot, status, created
- Sim speed segmented control: **0.5× · 1× · 2× · 5×**
- KPI ribbon: Queued / In progress / Completed

---

## 7. Live event feed

**File:** `components/events/LiveEventFeed.tsx`

- Rows: `time · robot-id · message`, with a 2 px severity rule on the left
- Severity → tone: INFO → blue, WARN → amber, DANGER → red, SUCCESS → green
- Source colour comes from the robot's own colour
- Redundant `AMR-0x` prefix is stripped for display only (the stored message is never modified)
- Compact variant collapses and shows `Waiting for events…` when empty
- Full variant fills the Event Feed view

---

## 8. Fleet management

**File:** `components/fleet/FleetGrid.tsx`

Cards with identity dot, id, live status badge, then rows for Battery (with meter), Distance, Speed, Task and Destination. Clicking a card selects that robot across the whole app. Selected card gets an emerald border and ring.

---

## 9. Dashboard & analytics

**Files:** `components/analytics/*`

| KPI | Source |
| --- | --- |
| Deliveries Completed | `tasks` where `COMPLETED` |
| Tasks Generated | `tasks.length` |
| Fleet Utilisation | non-IDLE/non-WAITING ÷ total |
| Average Battery | mean of `robots[].battery` |
| Total Distance | sum of `distanceTravelled` |
| Obstacle Events | events typed `DANGER` |
| Reroutes | events typed `WARN` |
| Corridor Waits | events containing "wait" |
| Route Assignments | `coordinationStats.totalAssignments` |
| Conflicts Resolved | `coordinationStats.totalConflictsResolved` |
| Peak Concurrent | `coordinationStats.peakConcurrentRoutes` |

---

## 10. Settings & theme

**File:** `components/settings/SettingsPanel.tsx`

| Section | Controls |
| --- | --- |
| Appearance | Dark mode (wired to `useThemeStore`) |
| Simulation | Auto-reset on completion, Show grid coordinates, Enable sound alerts |
| Display | Compact telemetry panel |
| About | Version, SIH id, stack |

> Note: the Simulation and Display toggles are currently local UI state — they render and animate but are not yet wired to the simulation. Wire them to `useFleetStore` when those behaviours are implemented.

---

## 11. Emergency handling

- **Global E-stop** in the header chip and the inspector freezes motion
- Per-robot `isEmergencyStopped` shows a pulsing red dot in the 3D scene
- **Bring all units online** clears the stop and returns every robot to `IDLE`
- Route locks held by a stopped robot expire after 8 s, so the rest of the fleet routes around it
