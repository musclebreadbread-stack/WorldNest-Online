import Phaser from "phaser";
import type {
  Entity,
  NpcComponent,
  PlayerComponent,
  RenderData,
  World,
} from "@worldnest/game-engine";
import { isMessageKey, translate } from "../i18n";
import { useLocaleStore } from "../stores/localeStore";

/** Labels sit above every sprite, including the local player. */
const NAME_TAG_DEPTH = 110;

/** Pixels above the entity position the label is centred on. */
const NAME_TAG_OFFSET_Y = 24;

const NAME_TAG_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: "10px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 3,
};

/**
 * NameTags floats a label above each remote player and each NPC.
 *
 * It mirrors the same `RenderData` the sprites do, so labels appear, follow and
 * disappear with their entity without any extra bookkeeping. The local player is
 * skipped — the camera already follows them and they know who they are.
 *
 * NPC names are i18n keys (decision D8), resolved here against `localeStore`; the
 * text is compared every pass, so switching language relabels the village without
 * a reload. A canvas has no `dir`, so the label itself does not mirror in Arabic.
 */
export class NameTags {
  private scene: Phaser.Scene;
  private world: World;
  /** Text objects keyed by ECS entity id. */
  private labels: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  /** Create, move and destroy labels to match the latest render data. */
  sync(renderData: RenderData[]): void {
    const seen = new Set<string>();

    for (const data of renderData) {
      const entity = this.world.getEntity(data.entityId);
      const name = labelFor(entity);
      if (!name) continue;

      seen.add(data.entityId);
      const label = this.labels.get(data.entityId) ?? this.createLabel(data, name);
      if (label.text !== name) label.setText(name);
      label.setPosition(data.x, data.y - NAME_TAG_OFFSET_Y);
      label.setVisible(data.visible);
    }

    for (const [entityId, label] of this.labels) {
      if (!seen.has(entityId)) {
        label.destroy();
        this.labels.delete(entityId);
      }
    }
  }

  /** Label for an entity, once it has been through a `sync` pass. */
  get(entityId: string): Phaser.GameObjects.Text | undefined {
    return this.labels.get(entityId);
  }

  destroy(): void {
    for (const label of this.labels.values()) {
      label.destroy();
    }
    this.labels.clear();
  }

  private createLabel(data: RenderData, name: string): Phaser.GameObjects.Text {
    const label = this.scene.add.text(
      data.x,
      data.y - NAME_TAG_OFFSET_Y,
      name,
      NAME_TAG_STYLE,
    );
    label.setOrigin(0.5, 1);
    label.setDepth(NAME_TAG_DEPTH);

    this.labels.set(data.entityId, label);
    return label;
  }
}

/** Text to label an entity with, or `null` when it needs no label. */
function labelFor(entity: Entity | undefined): string | null {
  const player = entity?.getComponent<PlayerComponent>("player");
  if (player) return player.isLocal ? null : player.username;

  const npc = entity?.getComponent<NpcComponent>("npc");
  if (!npc) return null;

  const locale = useLocaleStore.getState().locale;
  return isMessageKey(npc.nameKey) ? translate(locale, npc.nameKey) : npc.nameKey;
}
