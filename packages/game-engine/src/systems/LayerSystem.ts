import { InteractionComponent } from "../components/InteractionComponent";
import { PositionComponent } from "../components/PositionComponent";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { getFacedTile } from "../interaction/facing";
import { TileType } from "../world/Tilemap";
import type { TileQuery } from "../world/TileQuery";
import { WorldLayer } from "../world/WorldLayer";

export type LayerGetter = () => WorldLayer;
export type LayerSetter = (layer: WorldLayer) => void;

/** Consumes an interaction at a cave ladder and toggles the active world layer. */
export class LayerSystem extends System {
  constructor(
    private tileQuery: TileQuery,
    private getLayer: LayerGetter,
    private setLayer: LayerSetter,
  ) {
    super(["position", "interaction"]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const interaction = entity.getComponent<InteractionComponent>("interaction")!;
      if (!interaction.interactRequested) continue;

      const position = entity.getComponent<PositionComponent>("position")!;
      const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);
      if (this.tileQuery.getTileAt(tileX, tileY) !== TileType.CAVE_ENTRANCE) {
        continue;
      }

      this.setLayer(
        this.getLayer() === WorldLayer.SURFACE
          ? WorldLayer.UNDERGROUND
          : WorldLayer.SURFACE,
      );
      interaction.interactRequested = false;
    }
  }
}
