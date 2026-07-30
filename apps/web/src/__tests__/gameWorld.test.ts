import { describe, it, expect } from "vitest";
import {
  ColliderComponent,
  InputComponent,
  PositionComponent,
  TILE_PROPERTIES,
  WorldManager,
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

describe("createRemotePlayerEntity", () => {
  it("should create a smoothed, non-local player entity", () => {
    const entity = createRemotePlayerEntity("remote-1", "Friend", 10, 20);

    expect(entity.id).toBe(remotePlayerEntityId("remote-1"));
    expect(entity.hasComponent("remoteInterpolation")).toBe(true);
    expect(entity.hasComponent("input")).toBe(false);
  });
});
