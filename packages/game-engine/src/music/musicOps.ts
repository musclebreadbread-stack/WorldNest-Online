/**
 * Music / rhythm mini-game pure operations.
 *
 * All functions are pure: no side effects, no mutations. The system
 * layer calls these and writes the results to the component.
 */

import type { InventoryComponent } from "../components/InventoryComponent";
import { countItem } from "../inventory/inventoryOps";
import type { ItemId } from "@worldnest/shared";
import {
  NOTE_TIMING_GOOD_MS,
  NOTE_TIMING_PERFECT_MS,
  SCORE_GOOD,
  SCORE_PERFECT,
  SONG_COMPLETE_COINS,
  type RhythmNote,
  type SongDefinition,
} from "./musicDefinitions";
import type { MusicState, PerformanceScore, RhythmResult } from "./musicState";

/** Instrument item ids in the catalogue. */
const INSTRUMENT_ITEM_IDS: readonly ItemId[] = [
  "rhythm_drum",
  "rhythm_flute",
  "rhythm_harp",
  "rhythm_xylophone",
];

/**
 * Whether the player owns at least one instrument and can start a rhythm game.
 */
export function canStartRhythm(inventory: InventoryComponent): boolean {
  return INSTRUMENT_ITEM_IDS.some((id) => countItem(inventory, id) >= 1);
}

export interface StartSongResult {
  state: MusicState;
  songId: string;
  totalNotes: number;
}

/** Begin a song, returning the initial playing state. */
export function startSong(song: SongDefinition): StartSongResult {
  return {
    state: "playing",
    songId: song.id,
    totalNotes: song.notes.length,
  };
}

export interface TickRhythmResult {
  /** Notes that have become active since last tick. */
  pendingNotes: readonly RhythmNote[];
  /** Whether the song timer has exceeded the last note + grace period. */
  songEnded: boolean;
}

/**
 * Advance the song timer and emit notes whose timing has been reached.
 * `currentTime` is the total ms elapsed. `lastTime` is the previous tick time.
 */
export function tickRhythm(
  notes: readonly RhythmNote[],
  lastTime: number,
  currentTime: number,
): TickRhythmResult {
  const pendingNotes = notes.filter(
    (n) => n.timing > lastTime && n.timing <= currentTime,
  );
  const lastNoteTiming = notes.length > 0 ? notes[notes.length - 1].timing : 0;
  const songEnded = currentTime > lastNoteTiming + NOTE_TIMING_GOOD_MS;
  return { pendingNotes, songEnded };
}

/**
 * Evaluate a note hit attempt. Returns the timing result based on
 * how close the hit was to the expected note timing.
 */
export function hitNote(hitTime: number, expectedTiming: number): RhythmResult {
  const diff = Math.abs(hitTime - expectedTiming);
  if (diff <= NOTE_TIMING_PERFECT_MS) return "perfect";
  if (diff <= NOTE_TIMING_GOOD_MS) return "good";
  return "miss";
}

/**
 * Calculate final performance and coin reward for a completed song.
 */
export function completeSong(
  perfectCount: number,
  goodCount: number,
  missCount: number,
  maxCombo: number,
): { score: PerformanceScore; coins: number } {
  const totalScore = perfectCount * SCORE_PERFECT + goodCount * SCORE_GOOD;
  const score: PerformanceScore = {
    perfectCount,
    goodCount,
    missCount,
    maxCombo,
    totalScore,
  };
  const comboBonus = Math.floor(maxCombo / 3);
  const coins = SONG_COMPLETE_COINS + comboBonus;
  return { score, coins };
}

/** Minimum notes allowed in a composed melody. */
export const COMPOSE_MIN_NOTES = 4;
/** Maximum notes allowed in a composed melody. */
export const COMPOSE_MAX_NOTES = 16;

/**
 * Validate a player-composed melody. Returns true if the note sequence
 * meets the length constraints and all lanes are in range.
 */
export function composeMelody(notes: readonly RhythmNote[]): boolean {
  if (notes.length < COMPOSE_MIN_NOTES) return false;
  if (notes.length > COMPOSE_MAX_NOTES) return false;
  return notes.every((n) => n.lane >= 0 && n.lane <= 3 && n.timing >= 0);
}

/**
 * Score multiplier based on the current combo streak.
 * Every 5 consecutive hits grants an additional 0.5x multiplier, capped at 3x.
 */
export function getComboMultiplier(combo: number): number {
  const bonus = Math.floor(combo / 5) * 0.5;
  return Math.min(1 + bonus, 3);
}
