# Performance

Measured on the machine that produced commit `98c5adb` (2026-09-26). Re-run locally with `npm run build`.

## Build output

| Artifact | Raw | Gzipped |
| --- | ---: | ---: |
| `assets/index-*.js` | 1,281.55 kB | 354.68 kB |
| `assets/index-*.css` | 36.75 kB | 6.64 kB |
| `index.html` | 0.49 kB | 0.32 kB |
| Inter woff2 subsets | 199 kB total | — |

| Metric | Value |
| --- | --- |
| Modules transformed | 2,171 |
| Build wall time | ~6 s (`tsc` + `vite build`) |
| Type-check | `npx tsc --noEmit` → exit 0 in ~2 s |

### Bundle composition

The JS chunk is dominated by three.js + React Three Fiber, which is most of the 1.28 MB. React, Zustand, lucide-react and the application code together account for a small fraction.

> **Open optimisation:** there is no code splitting yet. A `React.lazy` split of the simulation view would move three.js/R3F out of the initial download for users who land on the Dashboard. Known deferred item.

---

## Runtime budgets

| Loop | Rate | Budget | Notes |
| --- | --- | --- | --- |
| Coordinator tick | 5 Hz (`COORD_TICK_MS = 200`) | < 2 ms | A\* over 13 nodes is trivial; the open-set scan is O(n) with n ≤ 13 |
| Motion tick | ~30 Hz (rAF) | < 0.5 ms | Position integration only — no planning |
| Pheromone decay | 5 Hz | O(segments) | Bounded by the number of traversed edges |
| Registry sweep | 5 Hz | O(locks + publications) | ≤ 13 locks, ≤ 5 publications |
| Task generation | every 10–30 s | O(1) | — |
| Sidebar counters | 1 s | O(1) | Reads three pre-computed values |
| Header clock | 1 s | O(1) | — |

Planning is intentionally **not** on the 30 Hz path: `planAndReserve` runs only on the coordinator tick, on destination change, or after `WAIT_TIMEOUT_MS` with a `REPLAN_COOLDOWN_MS = 1500` guard against thrashing.

## Algorithmic complexity

| Operation | Complexity | Scale here |
| --- | --- | --- |
| Graph build (module load) | O(n²) with an O(n) between-check | n = 13 |
| `findPath` (BFS) | O(V + E) | 13 nodes |
| `planRoute` (A\*) | O(E) with a linear open-set scan | ~30 edges — a heap would be overkill |
| `pheromoneMap.get/deposit` | O(1) | Hash map |
| `occupiedWaypoints` / `reservedSegments` | O(n) per query | ≤ 5 robots, ≤ 13 waypoints |
| Free-cell pick (obstacle placement) | O(cells × objects) | 25 cells × ~30 objects |

## Rendering

| Concern | Approach |
| --- | --- |
| Scene | Declarative R3F; meshes re-render only when store values they select change |
| Robot labels | `drei <Html>` — DOM overlays, cheap but excluded from the 3D draw call |
| Store subscriptions | Narrow selectors (`(s) => s.robots`), never whole-store reads |
| Derived metrics | Computed during render, not stored — no duplicate state to reconcile |
| Memoisation | `useMemo` on the task table's filtered/sorted list |
| CSS | One 37 kB stylesheet, no runtime CSS-in-JS |
| Fonts | Inter variable, subsetted woff2, `font-display: swap` via fontsource |

## Validation performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0, 2,171 modules |
| `console.log/warn/error` in `src/` | **0 matches** |
| Headless Chrome, dashboard view @ 1440×900 | 0 console errors |
| Headless Chrome, dashboard view @ 390×844 | 0 console errors |
| Headless Chrome, simulation view @ 390×844 | 0 console errors |
| Design-system classes present in built CSS | verified (`.ff-control-primary`, `.ff-seg-item-active`, `.ff-label`, `.tracking-label`, …) |
| Waypoint graph connectivity | 13/13 nodes, 0 unreachable pairs |

## Performance gotchas to keep in mind

1. **Do not plan inside `applyMotion`.** It runs every frame; route planning belongs on the 5 Hz coordinator.
2. **Do not build Tailwind class names dynamically.** It silently drops styles and costs a re-render to debug.
3. **Do not select the whole store.** Every robot position write re-renders anything holding `useFleetStore()`.
4. **Do not add per-frame DOM writes.** Labels are React-rendered; the 3D position comes from the store.
5. **Keep the graph small.** A\*'s open-set scan is linear; past a few hundred nodes, swap in a binary heap.
6. **Watch the single chunk.** If the bundle passes ~1.5 MB, introduce `React.lazy` for the simulation view.
