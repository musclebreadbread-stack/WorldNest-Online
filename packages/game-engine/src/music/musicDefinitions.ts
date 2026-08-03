/**
 * Music / rhythm mini-game definitions.
 *
 * Contains instrument types, timing constants, song catalogue, and
 * instrument definitions. Every player-visible string is an i18n key
 * (decision D8).
 */

/** The four playable instruments. */
export type InstrumentType = "drum" | "flute" | "harp" | "xylophone";

/** A single note in a rhythm chart. */
export interface RhythmNote {
  /** Milliseconds from song start when the note should be hit. */
  timing: number;
  /** Lane index (0-3) corresponding to a key/button. */
  lane: number;
}

/** Full definition of a playable song. */
export interface SongDefinition {
  id: string;
  nameKey: string;
  bpm: number;
  notes: readonly RhythmNote[];
}

/** Timing window (ms) for a perfect hit. */
export const NOTE_TIMING_PERFECT_MS = 50;

/** Timing window (ms) for a good hit. */
export const NOTE_TIMING_GOOD_MS = 150;

/** Score awarded per perfect hit. */
export const SCORE_PERFECT = 100;

/** Score awarded per good hit. */
export const SCORE_GOOD = 50;

/** Coins awarded per completed song (base). */
export const SONG_COMPLETE_COINS = 10;

export interface InstrumentDefinition {
  id: InstrumentType;
  nameKey: string;
  price: number;
}

export const INSTRUMENT_DEFINITIONS: readonly InstrumentDefinition[] = [
  { id: "drum", nameKey: "item.rhythm_drum", price: 30 },
  { id: "flute", nameKey: "item.rhythm_flute", price: 40 },
  { id: "harp", nameKey: "item.rhythm_harp", price: 50 },
  { id: "xylophone", nameKey: "item.rhythm_xylophone", price: 60 },
];

/**
 * Four built-in songs of increasing difficulty.
 * Notes use 0-based lanes and ms-based timing.
 */
export const SONG_DEFINITIONS: readonly SongDefinition[] = [
  {
    id: "sunny_stroll",
    nameKey: "music.song.sunny_stroll",
    bpm: 90,
    notes: [
      { timing: 667, lane: 0 },
      { timing: 1333, lane: 1 },
      { timing: 2000, lane: 2 },
      { timing: 2667, lane: 3 },
      { timing: 3333, lane: 0 },
      { timing: 4000, lane: 1 },
    ],
  },
  {
    id: "forest_jig",
    nameKey: "music.song.forest_jig",
    bpm: 110,
    notes: [
      { timing: 545, lane: 0 },
      { timing: 1091, lane: 2 },
      { timing: 1364, lane: 1 },
      { timing: 1636, lane: 3 },
      { timing: 2182, lane: 0 },
      { timing: 2727, lane: 2 },
      { timing: 3273, lane: 1 },
      { timing: 3818, lane: 3 },
    ],
  },
  {
    id: "ocean_breeze",
    nameKey: "music.song.ocean_breeze",
    bpm: 120,
    notes: [
      { timing: 500, lane: 1 },
      { timing: 1000, lane: 0 },
      { timing: 1250, lane: 2 },
      { timing: 1500, lane: 3 },
      { timing: 2000, lane: 1 },
      { timing: 2250, lane: 0 },
      { timing: 2500, lane: 2 },
      { timing: 3000, lane: 3 },
      { timing: 3500, lane: 0 },
      { timing: 4000, lane: 1 },
    ],
  },
  {
    id: "starlight_dance",
    nameKey: "music.song.starlight_dance",
    bpm: 140,
    notes: [
      { timing: 429, lane: 0 },
      { timing: 643, lane: 1 },
      { timing: 857, lane: 2 },
      { timing: 1071, lane: 3 },
      { timing: 1286, lane: 2 },
      { timing: 1500, lane: 1 },
      { timing: 1714, lane: 0 },
      { timing: 1929, lane: 3 },
      { timing: 2143, lane: 1 },
      { timing: 2357, lane: 2 },
      { timing: 2571, lane: 0 },
      { timing: 2786, lane: 3 },
    ],
  },
];

/** Look up a song by id. */
export function getSong(songId: string): SongDefinition | undefined {
  return SONG_DEFINITIONS.find((s) => s.id === songId);
}
