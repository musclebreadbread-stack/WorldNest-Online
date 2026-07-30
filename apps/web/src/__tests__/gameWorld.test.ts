import { describe, it, expect } from "vitest";
import {
  ColliderComponent,
  CROP_DEFINITIONS,
  InputComponent,
  PositionComponent,
  TILE_PROPERTIES,
  TileType,
  WorldManager,
  addItem,
  countItem,
  cropEntityId,
  selectSlot,
  structureEntityId,
} from "@worldnest/game-engine";
import type {
  AnimationComponent,
  CropComponent,
  InteractionComponent,
  InventoryComponent,
  RemoteInterpolationComponent,
  StatsComponent,
} from "@worldnest/game-engine";
import { TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import {
  createGameWorld,
  createRemotePlayerEntity,
  remotePlayerEntityId,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  LOCAL_PLAYER_ENTITY_ID,
  STARTING_WHEAT_SEEDS,
} from "../game/createGameWorld";
import { findFacingPair, findWalkableNeighbourOf } from "./helpers/terrain";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

describe("createGameWorld", () => {
  it("should build a local player entity from the bootstrap identity", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const position = playerEntity.getComponent<PositionComponent>("position")!;

    expect(playerEntity.id).toBe(LOCAL_PLAYER_ENTITY_ID);
    expect(position.x).toBe(DEFAULT_SPAWN_X);
    expect(position.y).toBe(DEFAULT_SPAWN_Y);
    expect(playerEntity.hasComponent("collider")).toBe(true);
  });

  it("should spawn the player on a walkable surface tile, never in a cave", () => {
    const worldManager = new WorldManager(WORLD_SEED, 1);
    const tileType = worldManager.getTileAt(
      Math.floor(DEFAULT_SPAWN_X / TILE_SIZE),
      Math.floor(DEFAULT_SPAWN_Y / TILE_SIZE),
    );

    expect(TILE_PROPERTIES[tileType].walkable).toBe(true);
    // Biomes and caves moved the terrain; the spawn constant has to survive it
    expect([TileType.CAVE_FLOOR, TileType.CAVE_WALL, TileType.ORE]).not.toContain(
      tileType,
    );
  });

  it("should stop the player at the water's edge instead of walking through", () => {
    // A walkable shore tile with water immediately to its west, found rather
    // than hard-coded so generator changes cannot invalidate the test
    const shore = findWalkableNeighbourOf(
      new WorldManager(WORLD_SEED, 1),
      TileType.WATER,
    );
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: shore.spawnX,
      spawnY: shore.spawnY,
    });
    const position = context.playerEntity.getComponent<PositionComponent>("position")!;
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const collider = context.playerEntity.getComponent<ColliderComponent>("collider")!;

    expect(
      context.worldManager.isWalkableAt(
        shore.targetTileX * TILE_SIZE + 1,
        shore.targetTileY * TILE_SIZE + 1,
      ),
    ).toBe(false);

    input.keys.left = true;
    for (let frame = 0; frame < 120; frame++) {
      context.world.update(1 / 60);
    }

    // The collider's left edge never crosses into the water tile
    expect(position.x - collider.width / 2).toBeGreaterThanOrEqual(
      shore.standTileX * TILE_SIZE,
    );
  });
});

describe("harvest wiring", () => {
  // A grass tile with stone immediately to its east, searched for by seed
  const STONE_PAIR = findFacingPair(
    new WorldManager(WORLD_SEED, 1),
    TileType.GRASS,
    TileType.STONE,
    "right",
  );
  const STAND_TILE_Y = STONE_PAIR.standTileY;
  const TARGET_TILE_X = STONE_PAIR.targetTileX;

  function createWorldFacingStone() {
    return createGameWorld({
      ...BOOTSTRAP,
      spawnX: STONE_PAIR.spawnX,
      spawnY: STONE_PAIR.spawnY,
    });
  }

  it("should harvest the faced tile into the inventory and grass it over", () => {
    const context = createWorldFacingStone();
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const stats = context.playerEntity.getComponent<StatsComponent>("stats")!;
    const repainted: Array<[number, number, TileType]> = [];
    context.worldManager.setTileChangeCallback((tileX, tileY, tileType) =>
      repainted.push([tileX, tileY, tileType]),
    );

    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.STONE,
    );

    interaction.facing = "right";
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    // Slot 0 holds the starting seeds, so the yield lands in the next free slot
    expect(inventory.slots[1]).toEqual({ itemId: "stone", quantity: 1 });
    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.GRASS,
    );
    expect(stats.energy).toBeLessThan(stats.maxEnergy);
    // The change is announced so ChunkRenderer can repaint just that tile
    expect(repainted).toEqual([[TARGET_TILE_X, STAND_TILE_Y, TileType.GRASS]]);
    expect(interaction.interactRequested).toBe(false);
  });

  it("should leave the world untouched without an interaction request", () => {
    const context = createWorldFacingStone();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    context.world.update(1 / 60);

    expect(inventory.slots.slice(1).every((slot) => slot === null)).toBe(true);
    expect(context.worldManager.getTileOverrides().size).toBe(0);
  });
});

describe("farming wiring", () => {
  // A grass tile with grass to its west, searched for by seed
  const GRASS_PAIR = findFacingPair(
    new WorldManager(WORLD_SEED, 1),
    TileType.GRASS,
    TileType.GRASS,
    "left",
  );
  const STAND_TILE_Y = GRASS_PAIR.standTileY;
  const TARGET_TILE_X = GRASS_PAIR.targetTileX;

  function createWorldFacingGrass() {
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: GRASS_PAIR.spawnX,
      spawnY: GRASS_PAIR.spawnY,
    });
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    interaction.facing = "left";
    return { context, interaction };
  }

  it("should start the player with wheat seeds selected", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const inventory = playerEntity.getComponent<InventoryComponent>("inventory")!;

    expect(inventory.slots[0]).toEqual({
      itemId: "wheat_seed",
      quantity: STARTING_WHEAT_SEEDS,
    });
    expect(inventory.selectedSlot).toBe(0);
  });

  it("should till grass, then sow a crop entity on the farmland", () => {
    const { context, interaction } = createWorldFacingGrass();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.GRASS,
    );

    // First interact tills the faced tile without spending a seed
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.FARMLAND,
    );
    expect(inventory.slots[0]).toEqual({
      itemId: "wheat_seed",
      quantity: STARTING_WHEAT_SEEDS,
    });

    // The second one sows it
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    const cropEntity = context.world.getEntity(
      cropEntityId(TARGET_TILE_X, STAND_TILE_Y),
    );
    expect(cropEntity).toBeDefined();
    expect(inventory.slots[0]).toEqual({
      itemId: "wheat_seed",
      quantity: STARTING_WHEAT_SEEDS - 1,
    });
    expect(context.systems.plant.getCropAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      cropEntity,
    );
  });

  it("should grow the crop off the world clock and yield produce when mature", () => {
    const { context, interaction } = createWorldFacingGrass();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    interaction.interactRequested = true;
    context.world.update(1 / 60);
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    const cropEntity = context.world.getEntity(
      cropEntityId(TARGET_TILE_X, STAND_TILE_Y),
    )!;
    const crop = cropEntity.getComponent<CropComponent>("crop")!;

    // The clock is derived from wall time, so maturity is faked by back-dating
    crop.plantedAtMinute -= crop.minutesPerStage * crop.stageCount;
    context.world.update(1 / 60);
    expect(crop.stage).toBe(crop.stageCount - 1);

    interaction.interactRequested = true;
    context.world.update(1 / 60);

    expect(
      context.world.getEntity(cropEntityId(TARGET_TILE_X, STAND_TILE_Y)),
    ).toBeUndefined();
    expect(countItem(inventory, "wheat")).toBe(
      CROP_DEFINITIONS.wheat_seed!.produceQuantity,
    );
  });
});

describe("building wiring", () => {
  // A grass tile with grass to its west, searched for by seed
  const BUILD_PAIR = findFacingPair(
    new WorldManager(WORLD_SEED, 1),
    TileType.GRASS,
    TileType.GRASS,
    "left",
  );
  const STAND_TILE_X = BUILD_PAIR.standTileX;
  const STAND_TILE_Y = BUILD_PAIR.standTileY;
  const TARGET_TILE_X = BUILD_PAIR.targetTileX;

  function createWorldWithFences() {
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: BUILD_PAIR.spawnX,
      spawnY: BUILD_PAIR.spawnY,
    });
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;

    addItem(inventory, "fence", 2);
    selectSlot(inventory, 1);
    interaction.facing = "left";

    return { context, inventory, interaction };
  }

  it("should place a fence on the faced tile and consume one item", () => {
    const { context, inventory, interaction } = createWorldWithFences();

    interaction.buildRequested = true;
    context.world.update(1 / 60);

    expect(
      context.world.getEntity(structureEntityId(TARGET_TILE_X, STAND_TILE_Y)),
    ).toBeDefined();
    expect(countItem(inventory, "fence")).toBe(1);
    expect(interaction.buildRequested).toBe(false);
  });

  it("should stop the player from walking through a placed fence", () => {
    const { context, interaction } = createWorldWithFences();
    const position = context.playerEntity.getComponent<PositionComponent>("position")!;
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const collider = context.playerEntity.getComponent<ColliderComponent>("collider")!;

    interaction.buildRequested = true;
    context.world.update(1 / 60);

    input.keys.left = true;
    for (let frame = 0; frame < 120; frame++) {
      context.world.update(1 / 60);
    }

    expect(position.x - collider.width / 2).toBeGreaterThanOrEqual(
      STAND_TILE_X * TILE_SIZE,
    );
  });
});

describe("animation wiring", () => {
  it("should walk the player animation in the direction it is moving", () => {
    const context = createGameWorld(BOOTSTRAP);
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const animation =
      context.playerEntity.getComponent<AnimationComponent>("animation")!;

    expect(animation.state).toBe("idle");

    input.keys.left = true;
    context.world.update(1 / 60);

    expect(animation.state).toBe("walk");
    expect(animation.direction).toBe("left");

    input.keys.left = false;
    context.world.update(1 / 60);

    expect(animation.state).toBe("idle");
    expect(animation.direction).toBe("left");
  });

  it("should animate remote players without a velocity component", () => {
    const context = createGameWorld(BOOTSTRAP);
    const entity = createRemotePlayerEntity("remote-1", "Friend", 0, 0);
    context.world.addEntity(entity);

    const interpolation = entity.getComponent<RemoteInterpolationComponent>(
      "remoteInterpolation",
    )!;
    interpolation.targetX = 1000;

    // A velocity component would let MovementSystem fight the interpolation
    expect(entity.hasComponent("velocity")).toBe(false);

    context.world.update(1 / 60);

    const animation = entity.getComponent<AnimationComponent>("animation")!;
    expect(animation.state).toBe("walk");
    expect(animation.direction).toBe("right");
  });
});

describe("createRemotePlayerEntity", () => {
  it("should create a smoothed, non-local player entity", () => {
    const entity = createRemotePlayerEntity("remote-1", "Friend", 10, 20);

    expect(entity.id).toBe(remotePlayerEntityId("remote-1"));
    expect(entity.hasComponent("remoteInterpolation")).toBe(true);
    expect(entity.hasComponent("animation")).toBe(true);
    expect(entity.hasComponent("input")).toBe(false);
  });
});
