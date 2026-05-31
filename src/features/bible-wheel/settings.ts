import type { DivisionKey, DivisionLabelStyles } from './bible-wheel.types';
import { DIVISIONS } from './bible-wheel.types';

/**
 * Full runtime settings loaded from bible-wheel-settings.json.
 * This allows non-developers to heavily customize the wheel's appearance
 * and Canon mode text without touching code.
 */
export interface BibleWheelSettings {
  version?: string;
  exportedAt?: string;

  divisionColors: Record<DivisionKey, string>;
  divisionLabelStyles: DivisionLabelStyles;

  // Override display names for normal mode and Canon mode
  divisions?: Array<{
    key: DivisionKey;
    label?: string;                    // Short name (normal mode)
    canonLabel?: string | string[];    // Canon mode label (string or [top, bottom])
  }>;
}

export interface DivisionDisplay {
  label: string;
  canonLabel?: string | string[];
}

let cachedSettings: BibleWheelSettings | null = null;

/**
 * Loads the wheel settings from the static JSON file.
 * Falls back to sensible built-in defaults if the file cannot be loaded.
 */
export async function loadBibleWheelSettings(): Promise<BibleWheelSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const res = await fetch('/data/bible-wheel-settings.json');
    if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);

    const json = await res.json();

    // Basic validation + merging with minimal fallbacks
    const settings: BibleWheelSettings = {
      version: json.version,
      exportedAt: json.exportedAt,
      divisionColors: json.divisionColors ?? {},
      divisionLabelStyles: json.divisionLabelStyles ?? {},
      divisions: json.divisions ?? undefined,
    };

    cachedSettings = settings;
    return settings;
  } catch (err) {
    console.warn('[BibleWheel] Could not load bible-wheel-settings.json. Falling back to DIVISIONS colors only (styles may be incomplete).', err);

    // Fallback derives colors strictly from the authoritative DIVISIONS definition.
    // Styles are intentionally minimal so the app remains usable; the JSON file is the design source of truth.
    const fallback: BibleWheelSettings = {
      divisionColors: Object.fromEntries(
        DIVISIONS.map(d => [d.key, d.defaultHex])
      ) as Record<DivisionKey, string>,
      divisionLabelStyles: {
        // Safe minimal styles (the real tuned values + per-division centerOffsets live in the JSON)
        torah:         { fontSize: 2.0, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
        otHistory:     { fontSize: 2.2, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
        wisdom:        { fontSize: 2.0, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
        majorProphets: { fontSize: 2.2, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
        minorProphets: { fontSize: 2.2, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
        gospels:       { fontSize: 2.2, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
        epistles:      { fontSize: 2.2, letterSpacing: 0.12, font: 'english', centerOffset: 0 },
      },
    };

    cachedSettings = fallback;
    return fallback;
  }
}

/**
 * Clears the cached settings (useful for hot-reloading the JSON during development).
 */
export function clearSettingsCache() {
  cachedSettings = null;
}
