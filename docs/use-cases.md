# Use Cases

What FleetForge demonstrates, and where the same approach applies in production.

---

## 1. Warehouse fleet operations

**The problem.** AMRs in a real warehouse contend for the same aisles. Centralised schedulers serialize movement and under-utilise the floor; purely local controllers deadlock at junctions.

**What FleetForge shows.** A middle path: each robot plans for itself with A\*, but against a *shared* view of reservations and a slowly-evolving congestion signal.

- Waypoint locks guarantee two robots never commit to the same node
- Segment reservations make head-on conflicts expensive enough to route around
- Pheromone decay reproduces the natural behaviour of traffic dispersing after a jam
- TTLs give liveness without a central arbiter

**Applicable to:** AMR/AGV fleets, auto-guided vehicles, port and yard tractors, airport baggage carts.

---

## 2. Digital-twin prototyping

**The problem.** Warehouse layouts are expensive to change physically, and control software is hard to test without hardware.

**What FleetForge shows.** The whole world is data: `LANES`, `WAYPOINTS`, `RACKS`, `OBSTACLES`, `CHARGING_PADS`, `DROP_ZONES` in one file. Edit a coordinate, reload, and the graph, planner, renderer and placement logic all follow.

**Applicable to:** pre-construction layout validation, rack re-slotting studies, safety reviews, training simulators.

---

## 3. Multi-agent coordination research

**The problem.** Demonstrating that a coordination strategy works — not just that it compiles.

**What FleetForge shows.** Instrumentation is built in:

| Signal | Where |
| --- | --- |
| Route assignments | `coordinationStats.totalAssignments` |
| Conflicts resolved | `coordinationStats.totalConflictsResolved` |
| Peak concurrent routes | `coordinationStats.peakConcurrentRoutes` |
| Corridor waits | events whose message contains "wait" |
| Reroutes | events typed `WARN` |
| Live locks | `routeRegistry.lockCount()` in the sidebar |

Change `PHEROMONE_COST_FACTOR`, `RESERVED_SEGMENT_PENALTY` or `LOCK_TTL_MS` and watch the numbers move.

**Applicable to:** comparing reservation vs. priority-based vs. auction-based coordination; A\* cost-function experiments; congestion-field tuning.

---

## 4. Operator interface design

**The problem.** Control-room UIs fail when they are decorative rather than informational.

**What FleetForge shows.** A hierarchy where colour and typography carry meaning:

- **Green** operational · **Blue** navigation/informational · **Cyan** charging · **Amber** pending · **Red** critical · **Slate** idle — one shared map (`status.ts`), no component invents its own
- Uppercase is reserved for system labels; everything an operator must *read* is normal case
- Numbers are tabular mono so columns never jitter
- Status is a dot plus a word, not a pill — a table of badges stays quiet
- The label on a robot only shows status when it is selected or needs attention

**Applicable to:** SCADA panels, dispatch consoles, telematics dashboards, any dense operational view.

---

## 5. Emergency & degraded-mode handling

**The problem.** The interesting failures are the ones where a unit stops responding.

**What FleetForge shows.** Degradation without a coordinator:

| Scenario | Behaviour |
| --- | --- |
| Global E-stop | Motion freezes; locks expire after 8 s; fleet routes around stopped units |
| Single robot blocked > 6 s | Hard replan, backoff, `WAITING` state surfaced to the operator |
| Robot removed/reset | `routeRegistry.clear()` + `pheromoneMap.clear()` + phase rebuild |
| Stale plan | Publication TTL (15 s) drops it; other robots stop avoiding a ghost |
| Planner returns `null` | Robot holds position instead of driving blind |

**Applicable to:** fault-tolerant control systems where a dead peer must not stall the group.

---

## 6. Education & interviewing

**What FleetForge demonstrates end-to-end:**

- React 19 + TypeScript strict-mode application architecture
- Zustand global state with narrow selectors
- A pure, React-free algorithm layer called from hooks
- Declarative three.js rendering via React Three Fiber
- A tokenised design system in CSS `@layer components`
- Strict CI gates: `tsc --noEmit`, production build, zero-console rule, headless browser smoke tests

---

## Constraints and honest limitations

| Limitation | Detail |
| --- | --- |
| No backend | State is in-memory; a reload resets the fleet |
| No persistence | No save/load of layouts or sessions |
| No auth | Single-user, local only |
| No real hardware | "Robots" are simulated; no MQTT/OPC-UA bridge |
| Single tab | `routeRegistry` is a module singleton — two tabs do not coordinate |
| 13-node graph | A\* uses a linear open-set scan; a larger warehouse needs a heap |
| Simulation settings | A few toggles in Settings are UI-only and not yet wired to the store |
| Bundle size | three.js is not yet code-split — see [Performance](performance.md) |

## Roadmap candidates

1. **Code-split** the simulation view (`React.lazy`) to shrink the initial chunk
2. **Persist** layout and session state to `localStorage`
3. **Bridge** to a real fleet via MQTT or OPC-UA behind the same `routeRegistry` interface
4. **Wire** the remaining Settings toggles to `useFleetStore`
5. **Swap** A\*'s open-set scan for a binary heap and lift the graph-size ceiling
6. **Unit-test** `engine/*` — it is already React-free and pure, so it needs no DOM harness
