# Bible Wheel — React Canon Wheel / Division Block Mode Handoff

**Date:** Current session (post-refinement)  
**Project:** `C:\Dev\Grok\biblewheel-react`  
**Focus:** Live-tunable Canon Wheel (Division / Block Mode) with full per-division artistic control

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