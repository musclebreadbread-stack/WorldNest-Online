import { TILE_SIZE, type ItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { AddEntity, RemoveEntityById } from "../ecs/World";
import { PositionComponent } from "../components/PositionComponent";
import { SpriteComponent } from "../components/SpriteComponent";
import { CropComponent } from "../components/CropComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { getSelectedItem, removeItem } from "../inventory/inventoryOps";
import { getFacedTile } from "../interaction/facing";
import { CROP_DEFINITIONS } from "../world/Crops";
import { TileType } from "../world/Tilemap";
import { getTileKey, type TileQuery } from "../world/TileQuery";
import type { SetTileOverride } from "./HarvestSystem";
import type { MinuteGetter } from "./CropGrowthSystem";

/** Tile-keyed lookup of live crops, so harvesting can find what is growing. */
export interface CropSource {
  getCropAt(tileX: number, tileY: number): Entity | undefined;
  removeCrop(tileX: number, tileY: number): void;
}

/** Entity id of the crop growing on a tile; one crop per tile. */
export function cropEntityId(tileX: number, tileY: number): string {
  return `crop-${tileX},${tileY}`;
}

/**
 * PlantSystem turns an interaction request into farmland and crops.
 *
 * With a seed selected, the first interact tills the faced grass tile into
 * farmland through the modification overlay, and the next one sows a crop entity
 * there and consumes a single seed. The request flag is only cleared when the
 * system actually acted, so a request it ignores still reaches `HarvestSystem`.
 *
 * It also owns the tile-keyed crop index and exposes it as a `CropSource`, which
 * is what lets `HarvestSystem` find a crop on the tile the player faces.
 */
export class PlantSystem extends System implements CropSource {
  private tileQuery: TileQuery;
  private setTileOverride: SetTileOverride;
  private addEntity: AddEntity;
  private removeEntity: RemoveEntityById;
  private getNowMinutes: MinuteGetter;
  private crops: Map<string, Entity> = new Map();

  constructor(
    tileQuery: TileQuery,
    setTileOverride: SetTileOverride,
    addEntity: AddEntity,
    removeEntity: RemoveEntityById,
    getNowMinutes: MinuteGetter = () => 0,
  ) {
    super(["position", "interaction", "inventory"]);
    this.tileQuery = tileQuery;
    this.setTileOverride = setTileOverride;
    this.addEntity = addEntity;
    this.removeEntity = removeEntity;
    this.getNowMinutes = getNowMinutes;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const interaction = entity.getComponent<InteractionComponent>("interaction")!;
      if (!interaction.interactRequested) continue;

      if (this.tryPlant(entity, interaction)) {
        interaction.interactRequested = false;
      }
    }
  }

  /** The crop growing on a tile, if any. */
  getCropAt(tileX: number, tileY: number): Entity | undefined {
    return this.crops.get(getTileKey(tileX, tileY));
  }

  /** Remove a crop from the index and from the world. */
  removeCrop(tileX: number, tileY: number): void {
    const key = getTileKey(tileX, tileY);
    const entity = this.crops.get(key);
    if (!entity) return;

    this.crops.delete(key);
    this.removeEntity(entity.id);
  }

  /** Every live crop, keyed by `"tileX,tileY"`; the diff persistence stores. */
  getCrops(): Map<string, Entity> {
    return this.crops;
  }

  /**
   * Create a crop entity on a tile without consuming a seed. Used internally by
   * planting and by the client when restoring saved crops.
   */
  spawnCrop(
    seedItemId: ItemId,
    tileX: number,
    tileY: number,
    plantedAtMinute: number,
  ): Entity | null {
    const definition = CROP_DEFINITIONS[seedItemId];
    if (!definition) return null;
    if (this.getCropAt(tileX, tileY)) return null;

    const entity = new Entity(cropEntityId(tileX, tileY));
    entity
      .addComponent(
        new PositionComponent(
          tileX * TILE_SIZE + TILE_SIZE / 2,
          tileY * TILE_SIZE + TILE_SIZE / 2,
        ),
      )
      .addComponent(new SpriteComponent(definition.textureKey, 0, true))
      .addComponent(
        new CropComponent(
          seedItemId,
          plantedAtMinute,
          definition.stageCount,
          definition.minutesPerStage,
          tileX,
          tileY,
        ),
      );

    this.crops.set(getTileKey(tileX, tileY), entity);
    this.addEntity(entity);
    return entity;
  }

  /** Whether the request was consumed by tilling or sowing. */
  private tryPlant(entity: Entity, interaction: InteractionComponent): boolean {
    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    const selected = getSelectedItem(inventory);
    if (!selected) return false;

    const definition = CROP_DEFINITIONS[selected.itemId];
    if (!definition) return false;

    const position = entity.getComponent<PositionComponent>("position")!;
    const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);
    const tileType = this.tileQuery.getTileAt(tileX, tileY);

    if (tileType === TileType.GRASS) {
      this.setTileOverride(tileX, tileY, TileType.FARMLAND);
      return true;
    }

    if (tileType !== TileType.FARMLAND) return false;

    return this.sow(inventory, selected.itemId, tileX, tileY);
  }

  private sow(
    inventory: InventoryComponent,
    seedItemId: ItemId,
    tileX: number,
    tileY: number,
  ): boolean {
    if (this.getCropAt(tileX, tileY)) return false;
    if (removeItem(inventory, seedItemId, 1) !== 1) return false;

    this.spawnCrop(seedItemId, tileX, tileY, this.getNowMinutes());
    return true;
  }
}
