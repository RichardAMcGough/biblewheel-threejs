# Bible Wheel — React (Vite + Three.js + R3F)

Faithful React port of the original Angular Bible Wheel.

## Quick Start

### React version (this folder)
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Original Angular version (for comparison)
From inside this folder you can start the original Angular app with a single command:

```bash
npm run serve:angular
```

Or open the browser automatically:

```bash
npm run serve:angular:open
```

The Angular version runs on **http://localhost:4200** (classic `ng serve`).

You can now easily run both side-by-side:
- React dev server → 5173
- Angular dev server → 4200

This is extremely useful while polishing the React port to achieve pixel-perfect visual + behavioral parity.

## Other useful commands

| Command                    | Description                              |
|----------------------------|------------------------------------------|
| `npm run dev`              | Start React + Vite dev server            |
| `npm run build`            | Production build of the React version    |
| `npm run preview`          | Preview the production React build       |
| `npm run serve:angular`    | Start the original Angular version       |
| `npm run serve:angular:open` | Same as above + auto-open browser      |
| `npm run build:angular`    | Production build of the Angular version  |

## Project Structure

```
biblewheel-react/
├── public/assets/fonts/     # sbl_hebrew.ttf + Inter-Bold.ttf (copied from Angular)
├── src/
│   ├── features/bible-wheel/
│   │   ├── BibleWheel.tsx          # The entire 3D wheel (wedges, blocks, curved Troika labels, animation, interaction)
│   │   ├── bible-wheel.types.ts    # Config, DIVISIONS, orientation maps (reverseFor / flipRotationFor)
│   │   └── bible-data.ts           # Slim 66-book list
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── package.json
└── vite.config.ts
```

## Key Features (matching the final Angular implementation)

- 3 concentric cycles (66 books)
- Gold containing ring (zero-gap)
- 3 gold canonical dividers
- Center Celtic cross + emissive pulse + glow
- ▣ **Division Block Mode** (Canon Wheel view) with 7 continuous colored arcs
- Curved per-character Troika labels with correct orientation (the famous `reverseFor` + `flipRotationFor` maps)
- Color picker + Export/Import settings JSON
- Hover lift + emissive boost (mode-aware)
- Entrance animation + idle pulse
- Exact same radii, heights, materials, and visual treatment as the Angular reference

## Comparison Workflow (recommended)

1. Terminal 1: `npm run serve:angular:open` (or just `ng serve` from the sibling folder)
2. Terminal 2: `npm run dev`
3. Hard refresh both browsers
4. Use the ▣ button in both and compare curved labels, hover behavior, colors, ring fit, etc.

## Notes

- The React version uses `@react-three/fiber` + `@react-three/drei` + raw `troika-three-text` (same library as Angular).
- All the hard-won Troika visibility forcing logic (`.sync()`, `renderOrder`, `depthTest=false`, multiple scheduled passes, etc.) has been ported.
- The orientation maps for curved division labels are identical to the final working version in Angular.

**For deep details on the Canon Wheel (Division Block Mode) and its live artistic controls**, see [HANDOFF.md](./HANDOFF.md). This is currently the most refined and tunable part of the application.

## Next Steps (for the larger vision)

This component is designed to live inside a bigger navigable "Biblical Worlds" experience that will also include:
- Isaiah-Bible Correlation view
- Biblical Holographs / Gematria

The clean separation (`features/bible-wheel/`) makes it easy to lift into a larger Three.js scene later.

---

**Port completed:** June 2026  
**Source of truth:** `C:\Dev\Grok\biblewheel` (Angular) — this React version aims for 100% visual + interactive fidelity.
