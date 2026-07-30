import { describe, it, expect } from "vitest";
import { ITEM_DEFINITIONS, TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { ColliderComponent } from "../components/ColliderComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StructureComponent } from "../components/StructureComponent";
import { BuildSystem, structureEntityId } from "../systems/BuildSystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { addItem, countItem, selectSlot } from "../inventory/inventoryOps";
import { TileType } from "../world/Tilemap";
import { getTileKey, type TileQuery } from "../world/TileQuery";

/** Tile source backed by an explicit map; everything else is grass. */
class FakeTileQuery implements TileQuery {
  public tiles: Map<string, TileType> = new Map();

  constructor(entries: Array<[number, number, TileType]> = []) {
    for (const [tileX, tileY, tileType] of entries) {
      this.tiles.set(getTileKey(tileX, tileY), tileType);
    }
  }

  getTileAt(tileX: number, tileY: number): TileType {
    return this.tiles.get(getTileKey(tileX, tileY)) ?? TileType.GRASS;
  }

  isWalkableAt(pixelX: number, pixelY: number): boolean {
    return (
      this.getTileAt(
        Math.floor(pixelX / TILE_SIZE),
        Math.floor(pixelY / TILE_SIZE),
      ) !== TileType.WATER
    );
  }
}

/** Player stands in the centre of tile (4, 4) facing the tile to its right. */
const PLAYER_TILE = 4;
const PLAYER_PIXEL = PLAYER_TILE * TILE_SIZE + TILE_SIZE / 2;
const TARGET_TILE_X = PLAYER_TILE + 1;

interface Harness {
  entity: Entity;
  interaction: InteractionComponent;
  inventory: InventoryComponent;
  tileQuery: FakeTileQuery;
  system: BuildSystem;
  spawned: Entity[];
}

function createHarness(targetTile: TileType = TileType.GRASS, fences = 3): Harness {
  const tileQuery = new FakeTileQuery([[TARGET_TILE_X, PLAYER_TILE, targetTile]]);
  const spawned: Entity[] = [];

  const interaction = new InteractionComponent("right");
  const inventory = new InventoryComponent();
  if (fences > 0) addItem(inventory, "fence", fences);

  const entity = new Entity("player")
    .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
    .addComponent(interaction)
    .addComponent(inventory);

  const system = new BuildSystem(tileQuery, (spawnedEntity) =>
    spawned.push(spawnedEntity),
  );

  return { entity, interaction, inventory, tileQuery, system, spawned };
}

describe("BuildSystem", () => {
  it("should require position, interaction and inventory", () => {
    const { system, entity } = createHarness();
    const partial = new Entity("prop").addComponent(new PositionComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });

  it("should do nothing without a build request", () => {
    const harness = createHarness();

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(0);
    expect(countItem(harness.inventory, "fence")).toBe(3);
  });

  it("should consume one item and create one structure entity", () => {
    const harness = createHarness();
    harness.interaction.buildRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "fence")).toBe(2);
    expect(harness.spawned).toHaveLength(1);

    const structureEntity = harness.spawned[0];
    const structure = structureEntity.getComponent<StructureComponent>("structure")!;
    expect(structureEntity.id).toBe(structureEntityId(TARGET_TILE_X, PLAYER_TILE));
    expect(structure.itemId).toBe("fence");
    expect(structure.collidable).toBe(true);
    expect(structureEntity.hasComponent("collider")).toBe(true);

    const position = structureEntity.getComponent<PositionComponent>("position")!;
    expect(position.x).toBe(TARGET_TILE_X * TILE_SIZE + TILE_SIZE / 2);
    expect(harness.system.getStructureAt(TARGET_TILE_X, PLAYER_TILE)).toBe(
      structureEntity,
    );
    expect(harness.interaction.buildRequested).toBe(false);
  });

  it("should use the texture key from the item definition", () => {
    const harness = createHarness();
    harness.interaction.buildRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.spawned[0].getComponent("sprite")).toBeDefined();
    expect(ITEM_DEFINITIONS.fence.structureTextureKey).toBe("structure_fence");
  });

  it("should not place on a non-buildable tile", () => {
    const harness = createHarness(TileType.WATER);
    harness.interaction.buildRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(0);
    expect(countItem(harness.inventory, "fence")).toBe(3);
  });

  it("should not place on an already occupied tile", () => {
    const harness = createHarness();
    harness.interaction.buildRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    harness.interaction.buildRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(1);
    expect(countItem(harness.inventory, "fence")).toBe(2);
  });

  it("should not place an item that is not a placeable structure", () => {
    const harness = createHarness(TileType.GRASS, 0);
    addItem(harness.inventory, "wood", 5);
    harness.interaction.buildRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(0);
    expect(countItem(harness.inventory, "wood")).toBe(5);
  });

  it("should report placement possibility for the build preview", () => {
    const harness = createHarness();

    expect(
      harness.system.canPlaceAt(harness.inventory, TARGET_TILE_X, PLAYER_TILE),
    ).toBe(true);

    harness.tileQuery.tiles.set(getTileKey(9, 9), TileType.WATER);
    expect(harness.system.canPlaceAt(harness.inventory, 9, 9)).toBe(false);

    selectSlot(harness.inventory, 1); // empty slot
    expect(
      harness.system.canPlaceAt(harness.inventory, TARGET_TILE_X, PLAYER_TILE),
    ).toBe(false);
  });

  // A villager standing on the tile is as good a reason not to build as a wall
  it("should refuse a tile another occupancy source has claimed", () => {
    const taken = getTileKey(TARGET_TILE_X, PLAYER_TILE);
    const occupancy = {
      hasStructureAt: (tileX: number, tileY: number) =>
        getTileKey(tileX, tileY) === taken,
      isBlockedByStructure: (tileX: number, tileY: number) =>
        getTileKey(tileX, tileY) === taken,
    };
    const tileQuery = new FakeTileQuery([[TARGET_TILE_X, PLAYER_TILE, TileType.GRASS]]);
    const spawned: Entity[] = [];
    const inventory = new InventoryComponent();
    addItem(inventory, "fence", 1);
    const interaction = new InteractionComponent("right");
    const entity = new Entity("player")
      .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
      .addComponent(interaction)
      .addComponent(inventory);
    const system = new BuildSystem(
      tileQuery,
      (spawnedEntity) => spawned.push(spawnedEntity),
      occupancy,
    );

    expect(system.canPlaceAt(inventory, TARGET_TILE_X, PLAYER_TILE)).toBe(false);

    interaction.buildRequested = true;
    system.update([entity], 1 / 60);

    expect(spawned).toHaveLength(0);
    expect(countItem(inventory, "fence")).toBe(1);
  });

  // What a `build` quest objective is judged by, polled rather than evented
  it("should count the placed structures of one kind", () => {
    const harness = createHarness();

    expect(harness.system.countStructures("fence")).toBe(0);

    harness.system.spawnStructure("fence", 1, 1);
    harness.system.spawnStructure("fence", 2, 1);
    harness.system.spawnStructure("chest", 3, 1);

    expect(harness.system.countStructures("fence")).toBe(2);
    expect(harness.system.countStructures("chest")).toBe(1);
    expect(harness.system.countStructures("wood")).toBe(0);
  });
});

describe("CollisionSystem with structures", () => {
  it("should veto movement into a collidable structure", () => {
    const harness = createHarness();
    harness.interaction.buildRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    const collision = new CollisionSystem(harness.tileQuery, harness.system);
    const velocity = new VelocityComponent(600, 0);
    const walker = new Entity("walker")
      .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
      .addComponent(velocity)
      .addComponent(new ColliderComponent(24, 24));

    collision.update([walker], 1 / 60);

    expect(velocity.vx).toBe(0);
  });

  it("should ignore structures when none are injected", () => {
    const harness = createHarness();
    harness.interaction.buildRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    const collision = new CollisionSystem(harness.tileQuery);
    const velocity = new VelocityComponent(600, 0);
    const walker = new Entity("walker")
      .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
      .addComponent(velocity)
      .addComponent(new ColliderComponent(24, 24));

    collision.update([walker], 1 / 60);

    expect(velocity.vx).toBe(600);
  });

  it("should let movement through a non-collidable structure", () => {
    const harness = createHarness();
    // Placed directly, bypassing the item flags, to isolate the collidable check
    const structureEntity = harness.system.spawnStructure(
      "fence",
      TARGET_TILE_X,
      PLAYER_TILE,
    )!;
    structureEntity.getComponent<StructureComponent>("structure")!.collidable = false;

    const collision = new CollisionSystem(harness.tileQuery, harness.system);
    const velocity = new VelocityComponent(600, 0);
    const walker = new Entity("walker")
      .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
      .addComponent(velocity)
      .addComponent(new ColliderComponent(24, 24));

    collision.update([walker], 1 / 60);

    expect(harness.system.hasStructureAt(TARGET_TILE_X, PLAYER_TILE)).toBe(true);
    expect(velocity.vx).toBe(600);
  });
});
