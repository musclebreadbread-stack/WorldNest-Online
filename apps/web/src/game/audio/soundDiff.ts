import type {
  DayPhase,
  Entity,
  InventoryComponent,
  StatsComponent,
} from "@worldnest/game-engine";
import type { SoundCue } from "./soundSpecs";

/**
 * Everything the audio layer needs to know about the game, once per frame.
 *
 * Cues are derived by diffing two of these rather than by an engine event bus
 * (decision D10): `HudBridge` already de-duplicates the exact same fields to
 * decide what to publish to React, so the pattern is established, and it keeps
 * `playSound()` calls out of six ECS systems.
 */
export interface SoundState {
  inventoryVersion: number;
  energy: number;
  buildMode: boolean;
  /** Live chat arrivals since the session started, not the log length. */
  chatCount: number;
  phase: DayPhase;
}

/**
 * Energy only ever regenerates upwards (`StatsSystem` never drains it), so any
 * fall at all is an action paying its cost. The epsilon is only there to absorb
 * floating-point noise.
 */
export const ENERGY_DROP_EPSILON = 0.5;

/**
 * Which cues to play for the change between two snapshots.
 *
 * The first snapshot of a session produces nothing: at boot the restored
 * inventory and energy differ from every default, and a burst of cues on the
 * loading screen is exactly what a player would call a bug.
 */
export function diffCues(prev: SoundState | null, next: SoundState): SoundCue[] {
  if (!prev) return [];

  const cues: SoundCue[] = [];

  // Spending energy is the audible part of harvesting, and it happens in the
  // same frame as the inventory gain, so both cues fire and layer.
  if (next.energy < prev.energy - ENERGY_DROP_EPSILON) cues.push("harvest");
  if (next.inventoryVersion > prev.inventoryVersion) cues.push("pickup");
  if (next.buildMode !== prev.buildMode || next.chatCount > prev.chatCount) {
    cues.push("ui");
  }

  return cues;
}

/**
 * Read a snapshot off the ECS. Phaser-free on purpose, so it can be driven by a
 * world built with `createGameWorld` under jsdom.
 */
export function readSoundState(
  playerEntity: Entity,
  buildMode: boolean,
  chatCount: number,
  phase: DayPhase,
): SoundState {
  const inventory = playerEntity.getComponent<InventoryComponent>("inventory");
  const stats = playerEntity.getComponent<StatsComponent>("stats");

  return {
    inventoryVersion: inventory?.version ?? 0,
    energy: stats?.energy ?? 0,
    buildMode,
    chatCount,
    phase,
  };
}
