import { Component } from "../ecs/Component";
import type { NpcRole } from "../world/NpcCatalogue";

/**
 * A placed NPC. Data only, copied from the catalogue at spawn time so nothing
 * downstream has to look the definition up again.
 *
 * `nameKey` is an i18n key rather than a name (decision D8): the floating label
 * is resolved by the client, which is what lets one NPC greet twelve languages.
 */
export class NpcComponent extends Component {
  public npcId: string;
  public nameKey: string;
  public dialogueId: string;
  public role: NpcRole;
  /** Tile the NPC was placed on; NPCs never move. */
  public tileX: number;
  public tileY: number;

  constructor(
    npcId: string,
    nameKey: string,
    dialogueId: string,
    role: NpcRole,
    tileX: number,
    tileY: number,
  ) {
    super("npc");
    this.npcId = npcId;
    this.nameKey = nameKey;
    this.dialogueId = dialogueId;
    this.role = role;
    this.tileX = tileX;
    this.tileY = tileY;
  }
}
