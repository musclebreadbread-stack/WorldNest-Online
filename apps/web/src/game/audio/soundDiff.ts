import type {
  DayPhase,
  DialogueComponent,
  Entity,
  InventoryComponent,
  QuestComponent,
  ShopComponent,
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
  /** Crops growing in the world; a rise is a seed going into the ground. */
  cropCount: number;
  /** Structures standing in the world; a rise is something being placed. */
  structureCount: number;
  buildMode: boolean;
  /** Live chat arrivals since the session started, not the log length. */
  chatCount: number;
  /** `DialogueComponent.version`; bumped by every accepted conversation change. */
  dialogueVersion: number;
  /** `ShopComponent.version`; bumped by an accepted trade and by open/close. */
  shopVersion: number;
  /** `QuestComponent.version`; bumped by a quest taken on, progressed or paid out. */
  questVersion: number;
  /**
   * Requests the engine turned down, shop and quest together. Only the total
   * matters: one refusal is one apologetic chime whatever refused it.
   */
  refusalCount: number;
  phase: DayPhase;
}

/**
 * Energy only ever regenerates upwards (`StatsSystem` never drains it), so any
 * fall at all is an action paying its cost. The epsilon is only there to absorb
 * floating-point noise.
 */
export const ENERGY_DROP_EPSILON = 0.5;

/**
 * How much of the world exists right now.
 *
 * Sowing and building are the two actions no component on the player can show:
 * both spend an item and then the *world* changes. The systems that own those
 * indexes are handed in as getters (`PlantSystem`, `BuildSystem`), which keeps
 * `OverlayContext` from having to widen for the audio layer.
 */
export interface WorldCounts {
  crops(): number;
  structures(): number;
}

/** Stand-in counts for a caller that has no world, used by the tests. */
export const NO_WORLD_COUNTS: WorldCounts = { crops: () => 0, structures: () => 0 };

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

  // Sowing and placing both spend an item, so they speak for the inventory
  // change instead of letting it chirp as if something had been picked up.
  const planted = next.cropCount > prev.cropCount;
  const built = next.structureCount > prev.structureCount;

  // Spending energy is the audible part of harvesting, and it happens in the
  // same frame as the inventory gain, so both cues fire and layer.
  if (next.energy < prev.energy - ENERGY_DROP_EPSILON) cues.push("harvest");
  if (next.inventoryVersion > prev.inventoryVersion && !planted && !built) {
    cues.push("pickup");
  }
  if (planted) cues.push("plant");
  if (built) cues.push("build");
  if (next.buildMode !== prev.buildMode || next.chatCount > prev.chatCount) {
    cues.push("ui");
  }
  // A conversation opening, moving on or ending is one line of dialogue
  if (next.dialogueVersion > prev.dialogueVersion) cues.push("dialogue");
  // A till chime for a trade — and for the panel opening, which is the same
  // "coins are involved now" moment to a player
  if (next.shopVersion > prev.shopVersion) cues.push("shop");
  // A quest taken on, moved along or handed in
  if (next.questVersion > prev.questVersion) cues.push("quest");
  // Last, so a refused purchase is heard after whatever else the frame did
  if (next.refusalCount > prev.refusalCount) cues.push("deny");

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
  counts: WorldCounts = NO_WORLD_COUNTS,
): SoundState {
  const inventory = playerEntity.getComponent<InventoryComponent>("inventory");
  const stats = playerEntity.getComponent<StatsComponent>("stats");
  const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue");
  const shop = playerEntity.getComponent<ShopComponent>("shop");
  const quest = playerEntity.getComponent<QuestComponent>("quest");

  return {
    inventoryVersion: inventory?.version ?? 0,
    energy: stats?.energy ?? 0,
    cropCount: counts.crops(),
    structureCount: counts.structures(),
    buildMode,
    chatCount,
    dialogueVersion: dialogue?.version ?? 0,
    shopVersion: shop?.version ?? 0,
    questVersion: quest?.version ?? 0,
    refusalCount: (shop?.refusals ?? 0) + (quest?.refusals ?? 0),
    phase,
  };
}
