# Configuration

FleetForge has **no runtime environment variables**. Everything below is build-time tooling.

---

## Environment variables

| Variable | Description | Required |
| --- | --- | --- |
| — | None are read by the application | — |

There is no `.env`, `.env.example` or backend endpoint in this repository.

**If you add any later:** Vite inlines every `VITE_`-prefixed variable into the client bundle. Anything in the browser build is public — never put secrets there. Server-only keys belong behind a separate service.

---

## Scripts

Defined in `package.json`:

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite` | Dev server with HMR → http://localhost:5173 |
| `build` | `tsc && vite build` | Type-check, then emit `dist/` |
| `preview` | `vite preview` | Serve the production build locally |

`build` runs `tsc` first, so a type error fails the build (and a Netlify deploy) before Vite ever starts.

---

## `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "useDefineForClassFields": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Project rules enforced by this config:**

| Rule | Consequence |
| --- | --- |
| `strict` | No implicit `any`, strict null checks |
| `noUnusedLocals` / `noUnusedParameters` | Unused parameters must be prefixed with `_` |
| `noFallthroughCasesInSwitch` | Every `case` needs a `break` or `return` |
| `isolatedModules` | Every file must be a valid ES module on its own |

Additional house rules (not compiler-enforced): **no `console.log/warn/error` in `src/`**, **no `any`**, **no `TODO` comments left behind**.

---

## `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
```

Plain config — no aliases, no proxy, no manual chunks.

> **Known:** the single JS chunk is ~1.28 MB (355 kB gzipped). Code-splitting the three.js scene is a pending optimisation — see [Performance](performance.md).

---

## `package.json`

`"type": "module"` — which is why **every Tailwind/PostCSS config is `.cjs`**.

### Runtime dependencies

| Package | Version | Used for |
| --- | --- | --- |
| `react`, `react-dom` | ^19 | UI |
| `zustand` | ^4.5 | Global state |
| `three` | ^0.186 | 3D engine |
| `@react-three/fiber` | ^9.8 | React renderer for three.js |
| `@react-three/drei` | ^10.7 | OrbitControls, Html, helpers |
| `lucide-react` | ^0.451 | Icons |
| `clsx`, `tailwind-merge` | | Class composition |
| `@fontsource-variable/inter` | ^5.3 | Inter variable font |

### Dev dependencies

`typescript` ^5 · `vite` ^5 · `@vitejs/plugin-react` · `tailwindcss` ^3.4 · `postcss` · `autoprefixer` · `@types/react` · `@types/react-dom` · `@types/three` · `@types/node`

---

## `tailwind.config.cjs`

```js
darkMode: 'class',          // toggled by useThemeStore on <html>
content: ['./index.html', './src/**/*.{ts,tsx}'],
```

### Radius scale (forced)

| Token | Value | Use |
| --- | ---: | --- |
| `rounded` | 3 px | Controls, inputs, chips |
| `rounded-sm` | 4 px | Meters |
| `rounded-md` | 6 px | — |
| `rounded-lg` / `-xl` / `-2xl` | 8 px | Panels, dialogs, cards |

Overriding these keeps every corner consistent without thinking about it.

### Shadow scale

Hairline borders carry the default elevation; shadow is reserved for overlays (`shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-2xl`).

### Letter-spacing tokens

| Token | Value | Use |
| --- | --- | --- |
| `tracking-label` | 0.09em | `.ff-label` uppercase system labels |
| `tracking-tight` | 0.04em | Large numeric values |

---

## `postcss.config.cjs`

```js
plugins: { tailwindcss: {}, autoprefixer: {} }
```

---

## `src/index.css`

Order matters — Tailwind's three layers must come first:

```css
@import '@fontsource-variable/inter';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then:

1. **Theme** — `:root { color-scheme: light }`, `.dark` override, body colours.
2. **Scrollbar** — 8 px thumb, light/dark variants.
3. **`.font-mono { font-variant-numeric: tabular-nums }`** — every mono value is tabular so columns never jitter.
4. **`@layer components`** — the `.ff-*` design system (see [Components](components.md#design-system-classes)).

> **Purge safety:** Tailwind only emits classes it can see as literal strings. Never build a class name by concatenation — write full literals, or map over an object of static strings.

---

## Hosting

| Concern | Value |
| --- | --- |
| Repo | https://github.com/Anmay001/FleetForge |
| Branch | `main` |
| Deploy | Netlify continuous deployment from `main` |
| Publish directory | `dist` |
| Build command | `npm run build` |
| Redirects | Not required — the app uses no client-side URL routing |

Pushing to `main` triggers a Netlify rebuild. Pull requests get deploy previews.

---

## Checklist for a change

1. `npx tsc --noEmit` → must exit 0
2. `npm run build` → must exit 0
3. `grep -r "console\." src/` → no matches
4. If you added a Tailwind class inside a variable, confirm it still appears in `dist/assets/index-*.css`
5. Update the relevant document in `docs/`
