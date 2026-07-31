/**
 * The NPC catalogue.
 *
 * NPCs are deterministically placed and now follow schedules derived from
 * the wall clock (decision D15). Each definition carries an _anchor_ rather
 * than a final tile, and `resolveNpcTile` snaps it to the nearest tile that
 * is actually stood on, so a generator change can never leave an NPC in a
 * lake.
 *
 * `nameKey` is an i18n key, not a name (decision D8) - the HUD resolves it.
 */
import type { NpcScheduleEntry } from "./npcSchedule";

export type NpcRole =
  "villager" | "shopkeeper" | "questgiver" | "curator" | "chef" | "rancher";

export interface NpcDefinition {
  id: string;
  nameKey: string;
  dialogueId: string;
  /** Where the NPC would like to stand, in tile coordinates. */
  anchorTileX: number;
  anchorTileY: number;
  textureKey: string;
  role: NpcRole;
  /**
   * Time-of-day schedule. When present, the NPC relocates to the scheduled
   * anchor each time the active entry changes. An NPC with no schedule keeps
   * its fixed anchor.
   */
  schedule?: readonly NpcScheduleEntry[];
}

/**
 * Three NPCs anchored around the default spawn, tile `(15, 10)`, so a new player
 * meets all of them without a hike: a villager for flavour, a shopkeeper who is
 * the only way into the shop, and a quest giver who both hands out and takes in
 * every starter quest.
 */
export const NPC_DEFINITIONS: readonly NpcDefinition[] = [
  {
    id: "villager_pip",
    nameKey: "npc.pip.name",
    dialogueId: "pip_welcome",
    anchorTileX: 13,
    anchorTileY: 11,
    textureKey: "npc_villager",
    role: "villager",
    schedule: [
      { fromHour: 0, activity: "rest", tileX: 13, tileY: 12 },
      { fromHour: 6, activity: "work", tileX: 14, tileY: 11 },
      { fromHour: 12, activity: "home", tileX: 13, tileY: 11 },
      { fromHour: 19, activity: "rest", tileX: 13, tileY: 12 },
    ],
  },
  {
    id: "shopkeeper_juno",
    nameKey: "npc.juno.name",
    dialogueId: "juno_shop",
    anchorTileX: 18,
    anchorTileY: 10,
    textureKey: "npc_shopkeeper",
    role: "shopkeeper",
    schedule: [
      { fromHour: 0, activity: "rest", tileX: 19, tileY: 10 },
      { fromHour: 8, activity: "market", tileX: 18, tileY: 10 },
      { fromHour: 18, activity: "home", tileX: 19, tileY: 11 },
      { fromHour: 22, activity: "rest", tileX: 19, tileY: 10 },
    ],
  },
  {
    id: "questgiver_ada",
    nameKey: "npc.ada.name",
    dialogueId: "ada_quests",
    anchorTileX: 15,
    anchorTileY: 13,
    textureKey: "npc_questgiver",
    role: "questgiver",
    schedule: [
      { fromHour: 0, activity: "rest", tileX: 16, tileY: 13 },
      { fromHour: 7, activity: "work", tileX: 15, tileY: 13 },
      { fromHour: 14, activity: "market", tileX: 17, tileY: 12 },
      { fromHour: 21, activity: "rest", tileX: 16, tileY: 13 },
    ],
  },
  {
    id: "curator_milo",
    nameKey: "npc.milo.name",
    dialogueId: "milo_museum",
    anchorTileX: 20,
    anchorTileY: 13,
    textureKey: "npc_curator",
    role: "curator",
    schedule: [
      { fromHour: 0, activity: "rest", tileX: 21, tileY: 14 },
      { fromHour: 8, activity: "museum", tileX: 20, tileY: 13 },
      { fromHour: 18, activity: "home", tileX: 21, tileY: 14 },
      { fromHour: 22, activity: "rest", tileX: 21, tileY: 14 },
    ],
  },
  {
    id: "chef_bao",
    nameKey: "npc.bao.name",
    dialogueId: "bao_cooking",
    anchorTileX: 12,
    anchorTileY: 13,
    textureKey: "npc_chef",
    role: "chef",
    schedule: [
      { fromHour: 0, activity: "rest", tileX: 12, tileY: 14 },
      { fromHour: 7, activity: "cooking", tileX: 12, tileY: 13 },
      { fromHour: 13, activity: "market", tileX: 17, tileY: 11 },
      { fromHour: 20, activity: "rest", tileX: 12, tileY: 14 },
    ],
  },
  {
    id: "rancher_hana",
    nameKey: "npc.hana.name",
    dialogueId: "hana_ranch",
    anchorTileX: 22,
    anchorTileY: 11,
    textureKey: "npc_rancher",
    role: "rancher",
    schedule: [
      { fromHour: 0, activity: "rest", tileX: 22, tileY: 12 },
      { fromHour: 6, activity: "ranch", tileX: 22, tileY: 11 },
      { fromHour: 12, activity: "market", tileX: 17, tileY: 10 },
      { fromHour: 19, activity: "rest", tileX: 22, tileY: 12 },
    ],
  },
];

/** Every role that has an NPC, in catalogue order. The client draws one per role. */
export const NPC_ROLES: readonly NpcRole[] = [
  ...new Set(NPC_DEFINITIONS.map((definition) => definition.role)),
];

/** Definition for an NPC id, or `undefined` when nothing is registered under it. */
export function getNpcDefinition(npcId: string): NpcDefinition | undefined {
  return NPC_DEFINITIONS.find((definition) => definition.id === npcId);
}
