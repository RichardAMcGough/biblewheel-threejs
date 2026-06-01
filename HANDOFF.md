# Bible Wheel — React Canon Wheel / Division Block Mode Handoff

**Date:** Current session (lighting + animation + label depth polish)  
**Project:** `C:\Dev\Grok\biblewheel-react`  
**Focus:** Live-tunable Canon Wheel + Presentation tools (View & Lighting panel, entrance animation, label depth best practices)

---

## Quick Start

```bash
cd biblewheel-react
npm run dev
```

Open http://localhost:5173

1. Click the gear icon (⚙) to open the advanced style panel.
2. Click the **▣** button to enter Canon Wheel (Division Block) mode.
3. Use the panel to live-tune **every** division independently:
   - Color
   - Heading font choice
   - Size
   - Spacing (angular letter spacing)
   - Center Offset (per-division)

**Pro tip for tuning:**  
Change a value → watch the curved text update live. For stubborn updates, toggle the ▣ button off and back on (nuclear reset). Hard refresh as a last resort.

---

## Current Architecture (Important)

We deliberately split the creation of the 7 division blocks for maximum artistic control:

### 1. `createDivisionBlockMeshes(group)`
- Creates the 7 large extruded 3D block meshes.
- Called **only once** at startup (inside `buildWheel`).
- These meshes are **never** recreated when you change styling in the panel.

### 2. `createDivisionLabels(group, styles, globalCenterOffset)`
- Creates **only** the curved TroikaText labels.
- Called at startup + every time you change anything in the style panel.
- This is the surgical function that gives you live tuning.

This separation was introduced so that changing Spacing, Size, Font, or Center Offset does **not** destroy and recreate the 3D colored blocks (which was causing visual glitches with the regular book cells earlier).

---

## The Style Panel (The Main Artistic Tool)

Located in `src/features/bible-wheel/components/ColorPickerPanel.tsx` (shown when gear ⚙ is clicked).

For each of the 7 divisions you can control independently:

| Control          | What it affects                              | Notes |
|------------------|----------------------------------------------|-------|
| Color            | Block + label color                          | Standard |
| Font             | Heading font choice                          | Currently all map to Inter-Bold until more .ttf files are added to `public/assets/fonts/` |
| Size             | Font size of the curved label                | Per-division |
| Spacing          | Angular letter spacing (`charAngularStep`)   | This is the big artistic lever |
| Center           | Per-division angular offset (radians)        | Added to the global Base Center Offset |

**Global control at the bottom:**
- **Base Center Offset** — added to every division’s individual Center value.

**Key discovery during tuning:**
- Cycle 3 divisions (Torah + Wisdom) needed a significantly different center offset (~ -0.52) compared to the outer cycles (~ +0.143).

---

## Spacing Behavior (No Artificial Cap)

There is **no longer** any 0.85× block-width safety cap on `textArcWidth`.

```ts
const textArcWidth = (numChars + 1) * step;   // can grow freely
```

This was intentionally removed because the design is being treated as a piece of art that must be fine-tuned by eye. Very high spacing values are allowed even if the text visually extends outside its colored block.

---

## Font Situation (Current Limitation)

All heading font options in the panel (`Inter Black`, `Bebas Neue`, `Oswald Bold`, `Montserrat Black`, `Anton`, `Roboto Black`, `Impact`) currently render using the single loaded English font (`Inter-Bold.ttf`).

To actually use different fonts for better clarity:

1. Add the desired `.ttf` files to `public/assets/fonts/`
2. Extend the font loading in `bible-wheel.types.ts` + `createCurvedText.ts`
3. Wire the new keys in the scene

Until then, the font selector is mostly for future-proofing and quick visual experimentation.

---

## Orientation Logic (Still Active)

The original `reverseFor` + `flipRotationFor` maps are still in `createDivisionLabels`:

```ts
const reverseFor = { wisdom: true, gospels: true };
const flipRotationFor = { wisdom: true, gospels: true };
```

These continue to work exactly as they did in the final Angular version.

The per-character logic inside `createCurvedText.ts` (including the `isBottomHalf` heuristic and character reversal) is unchanged.

---

## Hover Lift Behavior

- Regular book cells → lift via `wedgeRestZRef` + labels stored on the wedge mesh `userData`.
- Canon blocks → lift via the same pattern, but labels are attached to the division block meshes' `userData` inside `createDivisionLabels`.

Both systems are independent and fully functional.

---

## Key Files (React Version)

- `src/features/bible-wheel/BibleWheelScene.tsx`
  - `createDivisionBlockMeshes()`
  - `createDivisionLabels()` ← the heart of Canon tuning
  - Style change `useEffect` (the live update mechanism)
- `src/features/bible-wheel/components/ColorPickerPanel.tsx` ← the advanced per-division style editor
- `src/features/bible-wheel/utils/createCurvedText.ts` ← per-character arc placement
- `src/features/bible-wheel/bible-wheel.types.ts`
  - `DivisionLabelStyle`
  - `DEFAULT_DIVISION_LABEL_STYLES`
  - `HEADING_FONT_OPTIONS`
- `src/features/bible-wheel/BibleWheel.tsx` — orchestrator + persistence (localStorage + Export/Import)

---

## Recommended Tuning Workflow

1. Hard refresh.
2. Open gear panel.
3. Enter Canon mode (▣).
4. Adjust one division at a time.
5. If a label stops responding cleanly → toggle ▣ off/on.
6. When happy, use **Export Settings (JSON)** as your restore point.

---

## Known Good Practices

- The global "Base Center Offset" + per-division "Center" fields give you two layers of control. Use the per-division ones for final artistic alignment with the Hebrew letters.
- Spacing values above ~0.20–0.25 on short labels will cause noticeable spreading — this is now intentional.
- Font size and spacing interact. You will usually need to adjust both together when changing a division.

---

## Future Polish Ideas (Not Urgent)

- Actually load multiple heading fonts so the selector becomes meaningful.
- Add a "Max Width %" global control if you ever want a soft safety net back.
- Consider exposing `renderOrder` or material depth settings per division for very dense layouts.
- Persist the current view mode (normal vs Canon) in localStorage.

---

**Current Status (as of this handoff):**  
The Canon Wheel is now the most tunable part of the entire application. The live style panel + the separation of mesh creation from label creation gives you direct artistic control that was not present in the original Angular version.

This document + a recent backup should let anyone pick up the project and continue refining without losing the hard-won fine-tuning work.

---

## Encapsulation & Maintainability (Post Four-Hook Refactor + Three Follow-ups)

- **BibleWheelScene.tsx** reduced from ~1400 → ~687 lines (orchestrates four focused hooks + small creation helpers).
- **Four hooks** (useHebrewRing, useDivisionTransition, useWheelInteraction, useWheelAnimation) own their domains with clear APIs and JSDoc.
- **useBibleWheelSettings** extracted (Point 2): all JSON + localStorage + export/import/reset now lives in one hook. `BibleWheel.tsx` is a 137-line thin orchestrator.
- **Polish & cleanup** (Points 1+3): `HebrewCellUserData` type added + casts tightened; stale fallback defaults in settings.ts removed (now derives from DIVISIONS); barrel `index.ts` files added to hooks/, utils/, components/; remaining smells documented.
- **Checkpoints**: Git branches + annotated tags used before/after every major phase (see `git tag --list | grep checkpoint`).

The architecture is now ready for long-term extension. All changes were made via direct filesystem edits with build verification after every step.

Good luck — and may the curves be ever in your favor.

---

## View & Lighting Debug Panel (Critical for Final Presentation)

Located in the gear icon (⚙) → **View & Lighting** tab. This panel was built specifically to solve the final "looks great at most angles but washed out when flat" problems.

### Key Controls

| Control                    | Purpose                                                                 | Typical Useful Range      |
|---------------------------|-------------------------------------------------------------------------|---------------------------|
| **Env Intensity**         | Global environment map strength (biggest lever for overall washout)    | 0.5 – 0.85 (0.5 = moody) |
| **Resting Tilt (X)**      | Final artistic tilt after entrance. Prevents env glare hitting center of cross dead-on when wheel is flat. | ±0.06 to ±0.15 (user favorite: +0.06) |
| **Center Glow**           | Warm point light directly above the Celtic cross                        | Intensity 0.7–1.1, X/Y offsets to move hotspot |
| **Celtic Cross Env + Roughness** | Per-material control over environment reflections *only* on the gold cross | Env 0.6–1.0, Roughness 0.20–0.35 |

**Pro tip:**  
After the entrance animation finishes, open this tab and tweak live while the wheel is sitting at rest. The tilt and center glow offsets update in real time.

### Label Depth / RenderOrder Best Practices (Recent Fix)

- Small book labels (name + number) and Hebrew labels: `depthTest: true`, `depthWrite: false`, `renderOrder: 15` (or 50 for Hebrew).
- Canon blocks: `renderOrder: 10`
- Canon curved labels: `renderOrder: 20` (or 100 when fully visible) + `depthTest: false` (intentional overlay during transition)

This combination eliminates both "bold/thick text at glancing angles" and text incorrectly drawing in front of Canon blocks.

---

## Animation Entrance (Current Behavior)

- Duration: ~5.8 seconds (slow and majestic)
- Starts far away (Z=340)
- Strong Z spin (~3.1 turns) + visible Y-axis bounce (~35° one way then back)
- X rocking for shimmer during approach
- Smoothly eases into the current **Resting Tilt (X)** value from the debug panel in the final phase (no more hard jump)
- Small artistic final Y offset (~0.08 rad) for better 3D composition

The final tilt + Y offset can (and should) be tuned in the View & Lighting panel until the center cross looks rich even when the wheel is at its "rest" pose.

---

## Recommended Final Polish Workflow (2026)

1. Hard refresh.
2. Let the entrance play out.
3. Open gear → **View & Lighting**.
4. Set global **Env Intensity** to ~0.5 (great moody low-light look).
5. Adjust **Resting Tilt (X)** until the center cross stops being washed out when flat.
6. Use **Center Glow X/Y** to move any remaining hotspot off the middle of the cross.
7. Fine-tune **Celtic Cross Env Intensity / Roughness** for the gold specifically.
8. When happy with the final resting angle and lighting, note the values (or export settings if you also changed Canon styles).

The combination of the tilt control + per-cross material controls + center glow positioning gives you precise artistic control over the single most difficult presentation problem (flat-view washout on the central cross) without destroying the beautiful lighting at other angles.