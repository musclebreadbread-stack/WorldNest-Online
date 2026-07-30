import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { CropComponent } from "../components/CropComponent";
import { addItem, hasSpaceFor } from "../inventory/inventoryOps";
import { getFacedTile } from "../interaction/facing";
import { CROP_DEFINITIONS } from "../world/Crops";
import { TILE_HARVEST_YIELD, TILE_PROPERTIES, TileType } from "../world/Tilemap";
import type { TileQuery } from "../world/TileQuery";
import { isCropMature } from "./CropGrowthSystem";
import type { CropSource } from "./PlantSystem";

/** Applies a terrain change, normally `WorldManager.setTileOverride`. */
export type SetTileOverride = (
  tileX: number,
  tileY: number,
  tileType: TileType,
) => void;

/**
 * HarvestSystem turns an interaction request into an item.
 *
 * A crop growing on the faced tile is harvested first; otherwise the tile itself
 * must be harvestable, the entity must have the energy for it and room for the
 * yield, or the request is dropped without consuming the tile. Successful tile
 * harvests replace the tile with the yield's `replacementTile` (grass unless the
 * catalogue says otherwise) through the modification overlay, never by touching
 * the generator.
 */
export class HarvestSystem extends System {
  private tileQuery: TileQuery;
  private setTileOverride: SetTileOverride;
  private crops?: CropSource;

  constructor(
    tileQuery: TileQuery,
    setTileOverride: SetTileOverride,
    crops?: CropSource,
  ) {
    super(["position", "interaction", "inventory", "stats"]);
    this.tileQuery = tileQuery;
    this.setTileOverride = setTileOverride;
    this.crops = crops;
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

    // A crop occupies the tile it grows on, so it is checked before the terrain
    if (this.tryHarvestCrop(entity, tileX, tileY)) return;

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
    this.setTileOverride(tileX, tileY, yieldEntry.replacementTile ?? TileType.GRASS);
  }

  /**
   * Harvest a crop on the tile. Returns whether a crop was there at all, so an
   * immature crop shields the farmland underneath from a tile harvest.
   */
  private tryHarvestCrop(entity: Entity, tileX: number, tileY: number): boolean {
    const cropEntity = this.crops?.getCropAt(tileX, tileY);
    if (!cropEntity) return false;

    const crop = cropEntity.getComponent<CropComponent>("crop")!;
    if (!isCropMature(crop)) return true;

    const definition = CROP_DEFINITIONS[crop.itemId];
    if (!definition) return true;

    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    if (
      !hasSpaceFor(inventory, definition.produceItemId, definition.produceQuantity)
    ) {
      return true;
    }

    addItem(inventory, definition.produceItemId, definition.produceQuantity);
    // The farmland stays, so the tile can be sown again straight away
    this.crops!.removeCrop(tileX, tileY);
    return true;
  }
}
