/**
 * The NPC catalogue.
 *
 * NPCs are static and deterministically placed (decision D12): a wandering NPC
 * would drift apart on every client for the same reason an accumulated-delta
 * clock does, and keeping them in step would need a server the game does not
 * have. Each definition carries an *anchor* rather than a final tile, and
 * `resolveNpcTile` snaps it to the nearest tile that is actually stood on, so a
 * generator change can never leave an NPC in a lake.
 *
 * `nameKey` is an i18n key, not a name (decision D8) — the HUD resolves it.
 */
export type NpcRole = "villager" | "shopkeeper" | "questgiver";

export interface NpcDefinition {
  id: string;
  nameKey: string;
  dialogueId: string;
  /** Where the NPC would like to stand, in tile coordinates. */
  anchorTileX: number;
  anchorTileY: number;
  textureKey: string;
  role: NpcRole;
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
  },
  {
    id: "shopkeeper_juno",
    nameKey: "npc.juno.name",
    dialogueId: "juno_shop",
    anchorTileX: 18,
    anchorTileY: 10,
    textureKey: "npc_shopkeeper",
    role: "shopkeeper",
  },
  {
    id: "questgiver_ada",
    nameKey: "npc.ada.name",
    dialogueId: "ada_quests",
    anchorTileX: 15,
    anchorTileY: 13,
    textureKey: "npc_questgiver",
    role: "questgiver",
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
