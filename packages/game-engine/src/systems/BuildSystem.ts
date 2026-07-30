import { ITEM_DEFINITIONS, TILE_SIZE, type ItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { AddEntity } from "../ecs/World";
import { ColliderComponent } from "../components/ColliderComponent";
import { PositionComponent } from "../components/PositionComponent";
import { SpriteComponent } from "../components/SpriteComponent";
import { StructureComponent } from "../components/StructureComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { getSelectedItem, removeItem } from "../inventory/inventoryOps";
import { getFacedTile } from "../interaction/facing";
import { TILE_PROPERTIES } from "../world/Tilemap";
import { getTileKey, type TileQuery } from "../world/TileQuery";
import type { StructureQuery } from "../world/StructureQuery";

/** Entity id of the structure on a tile; one structure per tile. */
export function structureEntityId(tileX: number, tileY: number): string {
  return `structure-${tileX},${tileY}`;
}

/**
 * BuildSystem places the selected item on the tile the entity faces.
 *
 * A placement needs a buildable tile, a free tile and an item flagged
 * `placeableStructure`; otherwise the request is dropped without consuming
 * anything. The system owns the tile-keyed occupancy index and exposes it as a
 * `StructureQuery`, which is what lets `CollisionSystem` treat a fence as a wall.
 */
export class BuildSystem extends System implements StructureQuery {
  private tileQuery: TileQuery;
  private addEntity: AddEntity;
  private structures: Map<string, Entity> = new Map();

  constructor(tileQuery: TileQuery, addEntity: AddEntity) {
    super(["position", "interaction", "inventory"]);
    this.tileQuery = tileQuery;
    this.addEntity = addEntity;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const interaction = entity.getComponent<InteractionComponent>("interaction")!;
      if (!interaction.buildRequested) continue;

      this.tryBuild(entity, interaction);
      interaction.buildRequested = false;
    }
  }

  hasStructureAt(tileX: number, tileY: number): boolean {
    return this.structures.has(getTileKey(tileX, tileY));
  }

  isBlockedByStructure(tileX: number, tileY: number): boolean {
    const structure = this.getStructureAt(tileX, tileY);
    if (!structure) return false;

    return structure.getComponent<StructureComponent>("structure")!.collidable;
  }

  /** The structure standing on a tile, if any. */
  getStructureAt(tileX: number, tileY: number): Entity | undefined {
    return this.structures.get(getTileKey(tileX, tileY));
  }

  /** Every placed structure, keyed by `"tileX,tileY"`; the diff persistence stores. */
  getStructures(): Map<string, Entity> {
    return this.structures;
  }

  /**
   * Whether the selected item could be placed on a tile. Shared with the client's
   * build ghost so the preview and the placement rules can never disagree.
   */
  canPlaceAt(inventory: InventoryComponent, tileX: number, tileY: number): boolean {
    const selected = getSelectedItem(inventory);
    if (!selected) return false;
    if (ITEM_DEFINITIONS[selected.itemId].placeableStructure !== true) return false;
    const tileType = this.tileQuery.getTileAt(tileX, tileY);
    if (!TILE_PROPERTIES[tileType].buildable) return false;

    return !this.hasStructureAt(tileX, tileY);
  }

  /**
   * Create a structure entity without consuming an item. Used internally by
   * placement and by the client when restoring saved structures.
   */
  spawnStructure(itemId: ItemId, tileX: number, tileY: number): Entity | null {
    if (this.hasStructureAt(tileX, tileY)) return null;

    const definition = ITEM_DEFINITIONS[itemId];
    if (definition.placeableStructure !== true) return null;

    const collidable = definition.structureCollidable === true;
    const entity = new Entity(structureEntityId(tileX, tileY));
    entity
      .addComponent(
        new PositionComponent(
          tileX * TILE_SIZE + TILE_SIZE / 2,
          tileY * TILE_SIZE + TILE_SIZE / 2,
        ),
      )
      .addComponent(
        new SpriteComponent(definition.structureTextureKey ?? `structure_${itemId}`),
      )
      .addComponent(new StructureComponent(itemId, tileX, tileY, collidable));

    if (collidable) {
      entity.addComponent(new ColliderComponent(TILE_SIZE, TILE_SIZE));
    }

    this.structures.set(getTileKey(tileX, tileY), entity);
    this.addEntity(entity);
    return entity;
  }

  private tryBuild(entity: Entity, interaction: InteractionComponent): void {
    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    const position = entity.getComponent<PositionComponent>("position")!;
    const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);

    if (!this.canPlaceAt(inventory, tileX, tileY)) return;

    const selected = getSelectedItem(inventory)!;
    if (removeItem(inventory, selected.itemId, 1) !== 1) return;

    this.spawnStructure(selected.itemId, tileX, tileY);
  }
}
