export {
  NOTE_TIMING_GOOD_MS,
  NOTE_TIMING_PERFECT_MS,
  SCORE_GOOD,
  SCORE_PERFECT,
  SONG_COMPLETE_COINS,
  INSTRUMENT_DEFINITIONS,
  SONG_DEFINITIONS,
  getSong,
} from "./musicDefinitions";
export type {
  InstrumentType,
  RhythmNote,
  SongDefinition,
  InstrumentDefinition,
} from "./musicDefinitions";
export type { MusicState, RhythmResult, PerformanceScore } from "./musicState";
export {
  canStartRhythm,
  startSong,
  tickRhythm,
  hitNote,
  completeSong,
  composeMelody,
  getComboMultiplier,
  COMPOSE_MIN_NOTES,
  COMPOSE_MAX_NOTES,
} from "./musicOps";
export type { StartSongResult, TickRhythmResult } from "./musicOps";
