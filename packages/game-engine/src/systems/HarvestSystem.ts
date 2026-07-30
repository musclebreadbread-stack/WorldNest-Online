import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { addItem, hasSpaceFor } from "../inventory/inventoryOps";
import { getFacedTile } from "../interaction/facing";
import { TILE_HARVEST_YIELD, TILE_PROPERTIES, TileType } from "../world/Tilemap";
import type { TileQuery } from "../world/TileQuery";

/** Applies a terrain change, normally `WorldManager.setTileOverride`. */
export type SetTileOverride = (
  tileX: number,
  tileY: number,
  tileType: TileType,
) => void;

/**
 * HarvestSystem turns an interaction request into an item.
 *
 * The faced tile must be harvestable, the entity must have the energy for it and
 * room for the yield; otherwise the request is dropped without consuming the
 * tile. Successful harvests replace the tile with grass through the modification
 * overlay, never by touching the generator.
 */
export class HarvestSystem extends System {
  private tileQuery: TileQuery;
  private setTileOverride: SetTileOverride;

  constructor(tileQuery: TileQuery, setTileOverride: SetTileOverride) {
    super(["position", "interaction", "inventory", "stats"]);
    this.tileQuery = tileQuery;
    this.setTileOverride = setTileOverride;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const interaction = entity.getComponent<InteractionComponent>("interaction")!;
      if (!interaction.interactRequested) continue;

      this.tryHarvest(entity, interaction);
      interaction.interactRequested = false;
    }
  }

  private tryHarvest(entity: Entity, interaction: InteractionComponent): void {
    const position = entity.getComponent<PositionComponent>("position")!;
    const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);

    const tileType = this.tileQuery.getTileAt(tileX, tileY);
    if (!TILE_PROPERTIES[tileType].harvestable) return;

    const yieldEntry = TILE_HARVEST_YIELD[tileType];
    if (!yieldEntry) return;

    const stats = entity.getComponent<StatsComponent>("stats")!;
    if (stats.energy < yieldEntry.energyCost) return;

    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    if (!hasSpaceFor(inventory, yieldEntry.itemId, yieldEntry.quantity)) return;

    addItem(inventory, yieldEntry.itemId, yieldEntry.quantity);
    stats.energy -= yieldEntry.energyCost;
    this.setTileOverride(tileX, tileY, TileType.GRASS);
  }
}
