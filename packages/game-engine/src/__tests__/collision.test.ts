import { describe, it, expect } from "vitest";
import { TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { ColliderComponent } from "../components/ColliderComponent";
import { CollisionSystem } from "../systems/CollisionSystem";
import { TileType } from "../world/Tilemap";
import { getTileKey, type TileQuery } from "../world/TileQuery";

/**
 * Minimal TileQuery: every tile is grass except the ones listed as blocked.
 */
class FakeTileQuery implements TileQuery {
  private blocked: Set<string>;

  constructor(blockedTiles: Array<[number, number]>) {
    this.blocked = new Set(blockedTiles.map(([x, y]) => getTileKey(x, y)));
  }

  getTileAt(tileX: number, tileY: number): TileType {
    return this.blocked.has(getTileKey(tileX, tileY))
      ? TileType.WATER
      : TileType.GRASS;
  }

  isWalkableAt(pixelX: number, pixelY: number): boolean {
    return (
      this.getTileAt(Math.floor(pixelX / TILE_SIZE), Math.floor(pixelY / TILE_SIZE)) !==
      TileType.WATER
    );
  }
}

function createEntity(
  x: number,
  y: number,
  vx: number,
  vy: number,
  enabled = true,
): { entity: Entity; velocity: VelocityComponent } {
  const entity = new Entity("player");
  const velocity = new VelocityComponent(vx, vy);
  entity
    .addComponent(new PositionComponent(x, y))
    .addComponent(velocity)
    .addComponent(new ColliderComponent(24, 24, enabled));
  return { entity, velocity };
}

// Tile (2, 2) spans pixels 64..95 on both axes; centre of tile (1, 1) is (48, 48).
const CENTER_OF_TILE_1_1 = TILE_SIZE + TILE_SIZE / 2;

describe("CollisionSystem", () => {
  it("should only match entities with position, velocity and collider", () => {
    const system = new CollisionSystem(new FakeTileQuery([]));
    const { entity } = createEntity(0, 0, 0, 0);

    const noCollider = new Entity("ghost");
    noCollider
      .addComponent(new PositionComponent(0, 0))
      .addComponent(new VelocityComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(noCollider)).toBe(false);
  });

  it("should leave velocity untouched on open ground", () => {
    const system = new CollisionSystem(new FakeTileQuery([]));
    const { entity, velocity } = createEntity(
      CENTER_OF_TILE_1_1,
      CENTER_OF_TILE_1_1,
      200,
      200,
    );

    system.update([entity], 1 / 60);

    expect(velocity.vx).toBe(200);
    expect(velocity.vy).toBe(200);
  });

  it("should zero the x velocity when blocked on x only", () => {
    const system = new CollisionSystem(new FakeTileQuery([[2, 1]]));
    const { entity, velocity } = createEntity(
      CENTER_OF_TILE_1_1,
      CENTER_OF_TILE_1_1,
      600,
      0,
    );

    system.update([entity], 1 / 60);

    expect(velocity.vx).toBe(0);
    expect(velocity.vy).toBe(0);
  });

  it("should zero the y velocity when blocked on y only", () => {
    const system = new CollisionSystem(new FakeTileQuery([[1, 2]]));
    const { entity, velocity } = createEntity(
      CENTER_OF_TILE_1_1,
      CENTER_OF_TILE_1_1,
      0,
      600,
    );

    system.update([entity], 1 / 60);

    expect(velocity.vx).toBe(0);
    expect(velocity.vy).toBe(0);
  });

  it("should slide along the free axis when moving diagonally into a wall", () => {
    // Only the tile to the right is solid, so x is vetoed and y survives
    const system = new CollisionSystem(new FakeTileQuery([[2, 1]]));
    const { entity, velocity } = createEntity(
      CENTER_OF_TILE_1_1,
      CENTER_OF_TILE_1_1,
      600,
      600,
    );

    system.update([entity], 1 / 60);

    expect(velocity.vx).toBe(0);
    expect(velocity.vy).toBe(600);
  });

  it("should be a no-op when the collider is disabled", () => {
    const system = new CollisionSystem(new FakeTileQuery([[2, 1]]));
    const { entity, velocity } = createEntity(
      CENTER_OF_TILE_1_1,
      CENTER_OF_TILE_1_1,
      600,
      0,
      false,
    );

    system.update([entity], 1 / 60);

    expect(velocity.vx).toBe(600);
  });

  it("should ignore blocked tiles that the entity is not moving into", () => {
    // Wall to the left while moving right
    const system = new CollisionSystem(new FakeTileQuery([[0, 1]]));
    const { entity, velocity } = createEntity(
      CENTER_OF_TILE_1_1,
      CENTER_OF_TILE_1_1,
      600,
      0,
    );

    system.update([entity], 1 / 60);

    expect(velocity.vx).toBe(600);
  });
});
