import { describe, it, expect } from "vitest";
import {
  ColliderComponent,
  InputComponent,
  PositionComponent,
  TILE_PROPERTIES,
  TileType,
  WorldManager,
} from "@worldnest/game-engine";
import type {
  InteractionComponent,
  InventoryComponent,
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
} from "../game/createGameWorld";

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

  it("should spawn the player on a walkable tile", () => {
    const worldManager = new WorldManager(WORLD_SEED, 1);
    const tileType = worldManager.getTileAt(
      Math.floor(DEFAULT_SPAWN_X / TILE_SIZE),
      Math.floor(DEFAULT_SPAWN_Y / TILE_SIZE),
    );

    expect(TILE_PROPERTIES[tileType].walkable).toBe(true);
  });

  it("should stop the player at the water's edge instead of walking through", () => {
    // Tile (6, 4) is grass with water immediately to its west for WORLD_SEED
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: 6 * TILE_SIZE + TILE_SIZE / 2,
      spawnY: 4 * TILE_SIZE + TILE_SIZE / 2,
    });
    const position = context.playerEntity.getComponent<PositionComponent>("position")!;
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const collider = context.playerEntity.getComponent<ColliderComponent>("collider")!;

    expect(context.worldManager.isWalkableAt(5 * TILE_SIZE + 1, 4 * TILE_SIZE + 1)).toBe(
      false,
    );

    input.keys.left = true;
    for (let frame = 0; frame < 120; frame++) {
      context.world.update(1 / 60);
    }

    // The collider's left edge never crosses into the water tile
    expect(position.x - collider.width / 2).toBeGreaterThanOrEqual(6 * TILE_SIZE);
  });
});

describe("harvest wiring", () => {
  // Tile (20, 14) is grass with stone immediately to its east for WORLD_SEED
  const STAND_TILE_X = 20;
  const STAND_TILE_Y = 14;
  const TARGET_TILE_X = STAND_TILE_X + 1;

  function createWorldFacingStone() {
    return createGameWorld({
      ...BOOTSTRAP,
      spawnX: STAND_TILE_X * TILE_SIZE + TILE_SIZE / 2,
      spawnY: STAND_TILE_Y * TILE_SIZE + TILE_SIZE / 2,
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

    expect(inventory.slots[0]).toEqual({ itemId: "stone", quantity: 1 });
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

    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
    expect(context.worldManager.getTileOverrides().size).toBe(0);
  });
});

describe("createRemotePlayerEntity", () => {
  it("should create a smoothed, non-local player entity", () => {
    const entity = createRemotePlayerEntity("remote-1", "Friend", 10, 20);

    expect(entity.id).toBe(remotePlayerEntityId("remote-1"));
    expect(entity.hasComponent("remoteInterpolation")).toBe(true);
    expect(entity.hasComponent("input")).toBe(false);
  });
});
