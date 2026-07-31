import type Phaser from "phaser";
import { NPC_DEFINITIONS } from "@worldnest/game-engine";
import type { NpcRole } from "@worldnest/game-engine";

/** Placeholder NPCs are drawn at 16x16 like every other sprite, then scaled up. */
const NPC_TEXTURE_SIZE = 16;

/** Tunic and accent colour per role, so the three read apart at a glance. */
const NPC_COLORS: Record<NpcRole, { tunic: number; accent: number }> = {
  villager: { tunic: 0x66bb6a, accent: 0xf8bbd0 },
  shopkeeper: { tunic: 0xab47bc, accent: 0xffd54f },
  questgiver: { tunic: 0xff8a65, accent: 0xfff8e1 },
  curator: { tunic: 0x42a5f5, accent: 0xffe0b2 },
};

/**
 * One texture per NPC, derived from the engine catalogue so an NPC added there
 * cannot ship without a face.
 *
 * The silhouette matches the player's, so the village looks of a piece; the tunic
 * colour and the object held out in front say which role it is — flowers for the
 * gardener, a coin for the shop, paper for the quest list. Lives beside
 * `BootScene` rather than inside it purely for the ~300-line file cap.
 */
export function generateNpcTextures(scene: Phaser.Scene): void {
  for (const definition of NPC_DEFINITIONS) {
    const { tunic, accent } = NPC_COLORS[definition.role];
    const graphics = scene.add.graphics();

    // Feet
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRect(4, 13, 3, 3);
    graphics.fillRect(9, 13, 3, 3);

    // Tunic
    graphics.fillStyle(tunic, 1);
    graphics.fillRect(3, 4, 10, 9);

    // Head and eyes, always facing the player
    graphics.fillStyle(0xffcc80, 1);
    graphics.fillRect(5, 1, 6, 5);
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(6, 3, 2, 2);
    graphics.fillRect(9, 3, 2, 2);

    // What they are holding
    graphics.fillStyle(accent, 1);
    graphics.fillRect(11, 7, 4, 4);

    graphics.generateTexture(definition.textureKey, NPC_TEXTURE_SIZE, NPC_TEXTURE_SIZE);
    graphics.destroy();
  }
}
