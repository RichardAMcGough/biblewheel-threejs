# Bible Wheel — React Handoff

**Project:** `C:\Dev\Grok\biblewheel-react` · React 19 + R3F + three.js + troika-three-text
**Last updated:** 2026-06-08

A living reference for the parts that aren't obvious from the code. Keep it lean — prune anything that's been resolved.

---

## Quick Start

```bash
cd biblewheel-react
npm run dev      # http://localhost:5173
```

- **Left-drag** orbit · **right-drag** roll · **scroll** zoom · **⟲** reset view (or double-click empty space)
- **⚙** style panel · **▣** Canon (division block) mode
- For stubborn live updates: toggle ▣ off/on, then hard refresh as a last resort.

---

## Architecture

`BibleWheelScene.tsx` is the orchestrator; domain logic lives in focused hooks (each with its own JSDoc):

- **useHebrewRing** — Hebrew letter cells + spoke-hover highlighting
- **useDivisionTransition** — 7 Canon block meshes + cross-fade (skips heavy `label.sync()` once settled)
- **useWheelInteraction** — raycast hover/lift, click-to-select, empty-space double-click
- **useWheelAnimation** — entrance + per-frame rest pose (owns the demand-mode RAF loop)
- **useBibleWheelSettings** — all JSON + localStorage + export/import/reset
- **useDebugLighting** — lighting state + the View & Lighting panel

`BibleWheel.tsx` is a thin orchestrator (UI panels + wiring). Pure geometry/label helpers live in `utils/`.

**Key files:** `BibleWheelScene.tsx`, `components/ColorPickerPanel.tsx` (style panel), `utils/createCurvedText.ts` (per-char arc placement), `bible-wheel.types.ts` (`DEFAULT_BIBLE_WHEEL_CONFIG`, label styles, storage keys).

---

## Book Labels

Each book cell shows a short name + number. Two layouts, both produced by **`createBookLabels()` in `BibleWheelScene.tsx`** (single source — called by the initial build and by a live-rebuild effect):

- **Tangential** (default, outer cycles): name above number, text follows the arc.
- **Radial** (inner cycle always; all cycles when the toggle is on): text reads along the spoke.

**The "align book names along spokes" toggle** (`bookLabelsRadial`, gear → Styles tab): persists to `localStorage` (`biblewheel:bookLabelsRadial`) and the settings JSON. Geometry rules when radial:

- **Outer cycles:** name + number sit at the **same mid radius**, separated by a small **tangential angle** `dTheta = ((nameSize+numSize)*0.65)/rMid/2` so they stack (not strung inline). Each label is rotated by its **own** polar angle (`rotation + (labelAngle - angle)`) so a line through the text center is a true radius. The `0.65` factor drives both spacing and the per-label fan.
- **Cycle 3 (inner):** radial factors `0.64 / 0.20` (name/number), nudged toward center so long names ("1 Thess") clear the outer edge.

---

## Camera Controls

OrbitControls (`enableDamping 0.08`, `minDistance 50`, `maxDistance 160`, `enablePan false`, target `[0,0,4]`):

- **Vertical orbit is fully open** (polar clamps removed → 0–180°); azimuth was already free. OrbitControls cannot roll or tumble past the poles by design.
- **Roll** — right-button horizontal drag spins the wheel around its z-axis. Stored in `wheelRollRef`; the animation loop's rest pose re-applies it (`rotation.z = wheelRollRef.current`) so it survives Canon transitions. Sensitivity: `ROLL_PER_PX = 0.005`.
- **Reset view** — the ⟲ button and empty-space double-click both call `resetView` (published from the scene via `resetViewRef`). It **animates** camera orbit + zoom + roll back to home (`position0`/`target0` + roll 0) over 600ms easeOutCubic; OrbitControls is disabled during the tween and handed back at the end. Repeated presses cancel the in-flight tween.

---

## Demand Rendering (perf)

`Canvas` uses `frameloop="demand"`. `invalidate()` (from `useThree`) is threaded through every interaction/animation/effect that mutates the scene. The `useWheelAnimation` RAF loop **self-terminates** once the entrance and any Canon cross-fade settle, dropping idle GPU load.

### ⚠️ Two open behavioral items

1. **Idle cross pulse freezes** — the Celtic-cross / center-glow pulse runs inside the RAF loop, which now stops when idle. If you want a perpetual ambient pulse it needs its own always-on `invalidate()` tick.
2. **OrbitControls damping glide** — under demand rendering, post-release inertia relies on the `'change'→invalidate` loop self-sustaining. Flick-and-release and confirm it glides rather than snaps.

---

## Canon Mode & the Style Panel

`createDivisionBlockMeshes()` builds the 7 block meshes **once**; `createDivisionLabels()` rebuilds only the curved TroikaText labels on every style change (live tuning without destroying the blocks). Per division you can tune color, font, size, angular spacing (`charAngularStep` — the big artistic lever, no width cap), and per-division center offset (added to the global Base Center Offset).

- **Center-offset gotcha:** Cycle 3 divisions need ~`-0.52` vs ~`+0.143` on the outer cycles.
- **Orientation maps** (still active in `createDivisionLabels`): `reverseFor` / `flipRotationFor` are `{ wisdom, gospels }`. Per-char reversal + `isBottomHalf` logic lives in `createCurvedText.ts`.
- **Fonts:** the heading-font selector currently maps everything to `Inter-Bold.ttf`. To make it real, add `.ttf`s to `public/assets/fonts/` and extend loading in `bible-wheel.types.ts` + `createCurvedText.ts`.
- **Label depth (prevents z-fighting + draw-order bugs):** small/Hebrew labels `depthTest:true, depthWrite:false, renderOrder:15` (50 Hebrew); Canon blocks `renderOrder:10`; Canon labels `renderOrder:20` (100 when fully shown), `depthTest:false`.

---

## View & Lighting Panel (presentation)

Gear → **View & Lighting** tab. Built to fix flat-view washout on the central cross. Tweak live after the entrance settles:

| Control | Purpose | Useful range |
|---|---|---|
| **Env Intensity** | Global env-map strength (biggest washout lever) | 0.5–0.85 |
| **Resting Tilt (X)** | Final artistic tilt; keeps env glare off the cross when flat | ±0.06–0.15 |
| **Center Glow** | Warm point light over the cross (intensity + X/Y offset) | 0.7–1.1 |
| **Cross Env + Roughness** | Env reflections on the gold cross only | Env 0.6–1.0, Rough 0.20–0.35 |

Entrance animation: ~camera dolly from Z=340, Z-spin, Y-bounce, then eases into the Resting Tilt + a small Y offset (~0.08). When happy with colors/lighting, **Export Settings (JSON)** as your restore point.

---

## Tuning Knobs (quick reference)

| Want to change | Where |
|---|---|
| Radial label spacing / fan | `0.65` factor in `createBookLabels` (outer-cycle radial branch) |
| Cycle 3 label radius | `0.64 / 0.20` factors in `createBookLabels` (inner branch) |
| Hover lift | `config.hoverLiftZ` (1.2); cycle-3 uses `×0.6` in `useWheelInteraction` |
| Roll speed | `ROLL_PER_PX` (0.005) in `BibleWheelScene` |
| Reset speed/easing | `duration` (600ms) / easeOutCubic in `resetView` |
| Orbit limits | `<OrbitControls>` props in `BibleWheelScene` |
| Division center offsets | Style panel, or `DEFAULT_DIVISION_LABEL_STYLES` |
