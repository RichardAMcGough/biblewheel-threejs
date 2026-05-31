import type { DivisionKey, DivisionLabelStyles } from './bible-wheel.types';

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
    console.warn('[BibleWheel] Could not load bible-wheel-settings.json. Using built-in defaults.', err);

    // Minimal fallback defaults (should rarely be hit)
    const fallback: BibleWheelSettings = {
      divisionColors: {
        torah: '#6307ed',
        otHistory: '#6e1111',
        wisdom: '#6307ed',
        majorProphets: '#9467fe',
        minorProphets: '#b95f80',
        gospels: '#9467fe',
        epistles: '#458df2',
      },
      divisionLabelStyles: {
        torah:         { fontSize: 1.75, letterSpacing: 0.107, font: 'inter', centerOffset: -0.52 },
        otHistory:     { fontSize: 2.20, letterSpacing: 0.107, font: 'inter', centerOffset:  0.143 },
        wisdom:        { fontSize: 1.75, letterSpacing: 0.107, font: 'inter', centerOffset: -0.52 },
        majorProphets: { fontSize: 2.20, letterSpacing: 0.107, font: 'inter', centerOffset:  0.143 },
        minorProphets: { fontSize: 2.20, letterSpacing: 0.107, font: 'inter', centerOffset:  0.143 },
        gospels:       { fontSize: 2.20, letterSpacing: 0.107, font: 'inter', centerOffset:  0.143 },
        epistles:      { fontSize: 2.20, letterSpacing: 0.107, font: 'inter', centerOffset:  0.143 },
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
