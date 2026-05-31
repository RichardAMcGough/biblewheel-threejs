import type { Text as TroikaText } from 'troika-three-text';
import * as THREE from 'three';

/** Slim book type used throughout the Bible Wheel (no heavy verses data). */
export interface BibleWheelBook {
  position: number;
  longname: string;
  shortname: string;
  chapters: number;
}

/**
 * Data attached to every wedge mesh.
 * Used by raycasting (hover/click) so we can identify which book was interacted with
 * and move its labels in lockstep when the wedge lifts on hover.
 */
export interface WedgeUserData {
  book: BibleWheelBook;
  spoke: number;
  cycle: number;
  /** Troika Text labels riding on top of this wedge (book name + number). */
  labels: TroikaText[];
  /** Resting Z positions for the labels so we can restore them cleanly. */
  labelRestZ: number[];
  /** Stored for melting animation during Division mode transition */
  originalPosition?: THREE.Vector3;
}

/**
 * Data attached to each beveled Hebrew alphabet cell mesh.
 * Used by spoke-hover interaction so the cell + its two labels (glyph + name)
 * can be depressed together, while lifting the three corresponding book wedges.
 */
export interface HebrewCellUserData {
  spoke: number;
  type?: 'hebrewCell';
  /** Troika Text labels riding on the cell (glyph + romanized name). */
  labels: TroikaText[];
  /** Resting Z for the labels (relative to cell). */
  labelRestZ: number[];
  /** Resting Z for the cell itself (used for relative lift math). */
  cellRestZ?: number;
}

/**
 * Configuration for the Bible Wheel geometry and animation.
 * All major radii and heights are exposed so the visualization
 * can be tuned or driven from outside.
 */
export interface BibleWheelConfig {
  // === Radii (XY plane) ===
  rCenter: number;
  rCycle3: number;
  rCycle2: number;
  rCycle1: number;
  rLetter: number;

  // === Heights (Z / depth) ===
  hBack: number;
  hCycle1: number;
  hCycle2: number;
  hCycle3: number;
  hLetter: number;
  hRim: number;
  hDisc: number;
  hCross: number;

  // === Animation & interaction tuning ===
  hoverLiftZ?: number;
  entranceDuration?: number;
  pulseFrequency?: number;

  // Optional decorative gold ring around the inner Celtic cross
  // (styled to match the gold canon dividers / outer ring)
  showInnerGoldRing?: boolean;
}

export const DEFAULT_BIBLE_WHEEL_CONFIG: BibleWheelConfig = {
  rCenter: 6,
  rCycle3: 15,
  rCycle2: 23,
  rCycle1: 31,
  rLetter: 36.6,

  hBack: 0.4,
  hCycle1: 1.0,
  hCycle2: 1.6,
  hCycle3: 2.4,
  hLetter: 1.4,
  hRim: 2.8,
  hDisc: 3.0,
  hCross: 1.6,

  hoverLiftZ: 1.2,
  entranceDuration: 1.4,
  pulseFrequency: 1.6,

  // Optional decorative gold ring around the inner Celtic cross
  // (styled to match the gold canon dividers / outer ring)
  showInnerGoldRing: false,
};

// Division keys and data (exact match to Angular final)
export type DivisionKey =
  | 'torah' | 'otHistory' | 'wisdom'
  | 'majorProphets' | 'minorProphets'
  | 'gospels' | 'epistles';

export interface Division {
  key: DivisionKey;
  label: string;
  range: string;
  defaultHex: string;
  contains: (position: number) => boolean;
  /** Optional custom label for Canon (Division) mode. Can be string or [topLine, bottomLine] for two-arc labels. */
  canonLabel?: string | string[];
}

// User's final colors (from Angular session). These are the authoritative defaults.
export const DIVISIONS: Division[] = [
  { key: 'torah',         label: 'Torah',          range: 'Gen–Deut (1–5)',    defaultHex: '#6307ed', contains: p => p <= 5 },
  { key: 'otHistory',     label: 'OT History',     range: 'Josh–Esth (6–17)',  defaultHex: '#6e1111', canonLabel: 'OLD TESTAMENT HISTORY', contains: p => p >= 6  && p <= 17 },
  { key: 'wisdom',        label: 'Wisdom',         range: 'Job–Song (18–22)',  defaultHex: '#6307ed', contains: p => p >= 18 && p <= 22 },
  { key: 'majorProphets', label: 'Major Prophets', range: 'Isa–Dan (23–27)',   defaultHex: '#9467fe', contains: p => p >= 23 && p <= 27 },
  { key: 'minorProphets', label: 'Minor Prophets', range: 'Hos–Mal (28–39)',   defaultHex: '#b95f80', contains: p => p >= 28 && p <= 39 },
  { key: 'gospels',       label: 'Gospels & Acts', range: 'Matt–Acts (40–44)', defaultHex: '#9467fe', canonLabel: 'NT HISTORY', contains: p => p >= 40 && p <= 44 },
  { key: 'epistles',      label: 'Epistles',       range: 'Rom–Rev (45–66)',   defaultHex: '#458df2', canonLabel: ['NT', 'EPISTLES'], contains: p => p >= 45 },
];

export const STORAGE_KEY = 'biblewheel:divisionColors';
export const LABEL_STYLES_STORAGE_KEY = 'biblewheel:divisionLabelStyles';
export const DIVISION_DISPLAY_STORAGE_KEY = 'biblewheel:divisionDisplay';

export interface DivisionLabelStyle {
  fontSize: number;
  letterSpacing: number;     // angular step between characters (radians)
  font: string;              // heading font key (e.g. 'inter', 'bebas', 'oswald'...)
  centerOffset?: number;     // per-division visual centering correction (radians)
}

export type DivisionLabelStyles = Record<DivisionKey, DivisionLabelStyle>;

// Popular clear "Heading" fonts for block labels (best legibility when curved)
export const HEADING_FONT_OPTIONS = [
  { value: 'inter',      label: 'Inter Black' },
  { value: 'bebas',      label: 'Bebas Neue' },
  { value: 'oswald',     label: 'Oswald Bold' },
  { value: 'montserrat', label: 'Montserrat Black' },
  { value: 'anton',      label: 'Anton' },
  { value: 'roboto',     label: 'Roboto Black' },
  { value: 'impact',     label: 'Impact' },
] as const;

// Use the tuned values from bible-wheel-settings.json as the true defaults.
// NOTE: This is a build-time import (for any legacy static consumers). Runtime loading + localStorage
// overrides are handled exclusively by useBibleWheelSettings / loadBibleWheelSettings.
import settings from '../../../bible-wheel-settings.json';

export const DEFAULT_DIVISION_LABEL_STYLES: DivisionLabelStyles = (settings as any).divisionLabelStyles;

export function divisionFor(position: number): Division {
  for (const d of DIVISIONS) if (d.contains(position)) return d;
  return DIVISIONS[DIVISIONS.length - 1];
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export function intToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

// Hebrew letters for the outer band (exact)
export const HEBREW_LETTERS: { name: string; glyph: string }[] = [
  { name: 'Aleph',  glyph: 'א' },
  { name: 'Bet',    glyph: 'ב' },
  { name: 'Gimel',  glyph: 'ג' },
  { name: 'Dalet',  glyph: 'ד' },
  { name: 'Hey',    glyph: 'ה' },
  { name: 'Vav',    glyph: 'ו' },
  { name: 'Zayin',  glyph: 'ז' },
  { name: 'Chet',   glyph: 'ח' },
  { name: 'Tet',    glyph: 'ט' },
  { name: 'Yod',    glyph: 'י' },
  { name: 'Kaph',   glyph: 'כ' },
  { name: 'Lamed',  glyph: 'ל' },
  { name: 'Mem',    glyph: 'מ' },
  { name: 'Nun',    glyph: 'נ' },
  { name: 'Samekh', glyph: 'ס' },
  { name: 'Ayin',   glyph: 'ע' },
  { name: 'Pey',    glyph: 'פ' },
  { name: 'Tzadi',  glyph: 'צ' },
  { name: 'Quph',   glyph: 'ק' },
  { name: 'Resh',   glyph: 'ר' },
  { name: 'Shin',   glyph: 'ש' },
  { name: 'Tav',    glyph: 'ת' },
];

// Font paths (relative to public)
export const FONTS = {
  hebrew: '/assets/fonts/sbl_hebrew.ttf',
  english: '/assets/fonts/Inter-Bold.ttf',
} as const;

export type FontKey = keyof typeof FONTS;
