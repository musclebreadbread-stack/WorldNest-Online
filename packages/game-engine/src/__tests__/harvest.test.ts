import { describe, it, expect } from "vitest";
import { ITEM_DEFINITIONS, TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { HarvestSystem } from "../systems/HarvestSystem";
import { addItem, countItem } from "../inventory/inventoryOps";
import { getFacedTile } from "../interaction/facing";
import { TILE_HARVEST_YIELD, TileType } from "../world/Tilemap";
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

  isWalkableAt(): boolean {
    return true;
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
  stats: StatsComponent;
  tileQuery: FakeTileQuery;
  system: HarvestSystem;
  overrides: Array<[number, number, TileType]>;
}

function createHarness(targetTile: TileType): Harness {
  const tileQuery = new FakeTileQuery([[TARGET_TILE_X, PLAYER_TILE, targetTile]]);
  const overrides: Array<[number, number, TileType]> = [];

  const interaction = new InteractionComponent("right");
  const inventory = new InventoryComponent();
  const stats = new StatsComponent();
  const entity = new Entity("player")
    .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
    .addComponent(interaction)
    .addComponent(inventory)
    .addComponent(stats);

  const system = new HarvestSystem(tileQuery, (tileX, tileY, tileType) => {
    tileQuery.tiles.set(getTileKey(tileX, tileY), tileType);
    overrides.push([tileX, tileY, tileType]);
  });

  return { entity, interaction, inventory, stats, tileQuery, system, overrides };
}

describe("getFacedTile", () => {
  it("should offset the tile by one in the facing direction", () => {
    expect(getFacedTile(PLAYER_PIXEL, PLAYER_PIXEL, "right")).toEqual({
      tileX: PLAYER_TILE + 1,
      tileY: PLAYER_TILE,
    });
    expect(getFacedTile(PLAYER_PIXEL, PLAYER_PIXEL, "up")).toEqual({
      tileX: PLAYER_TILE,
      tileY: PLAYER_TILE - 1,
    });
  });
});

describe("HarvestSystem", () => {
  it("should require position, interaction, inventory and stats", () => {
    const { system, entity } = createHarness(TileType.FOREST);
    const partial = new Entity("prop").addComponent(new PositionComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });

  it("should do nothing without a request", () => {
    const { system, entity, inventory, overrides } = createHarness(TileType.FOREST);

    system.update([entity], 1 / 60);

    expect(countItem(inventory, "wood")).toBe(0);
    expect(overrides).toHaveLength(0);
  });

  it("should yield wood and grass-ify a forest tile", () => {
    const harness = createHarness(TileType.FOREST);
    harness.interaction.interactRequested = true;
    const energyBefore = harness.stats.energy;

    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "wood")).toBe(1);
    expect(harness.overrides).toEqual([[TARGET_TILE_X, PLAYER_TILE, TileType.GRASS]]);
    expect(harness.stats.energy).toBe(
      energyBefore - TILE_HARVEST_YIELD[TileType.FOREST]!.energyCost,
    );
    expect(harness.interaction.interactRequested).toBe(false);
  });

  it("should yield stone and flowers from their tiles", () => {
    const stoneHarness = createHarness(TileType.STONE);
    stoneHarness.interaction.interactRequested = true;
    stoneHarness.system.update([stoneHarness.entity], 1 / 60);

    const flowerHarness = createHarness(TileType.FLOWERS);
    flowerHarness.interaction.interactRequested = true;
    flowerHarness.system.update([flowerHarness.entity], 1 / 60);

    expect(countItem(stoneHarness.inventory, "stone")).toBe(1);
    expect(countItem(flowerHarness.inventory, "flower")).toBe(1);
  });

  it("should yield ore and leave cave floor behind, not grass", () => {
    const harness = createHarness(TileType.ORE);
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "ore")).toBe(1);
    // Mining underground must not plant grassland in the dark
    expect(harness.overrides).toEqual([
      [TARGET_TILE_X, PLAYER_TILE, TileType.CAVE_FLOOR],
    ]);
  });

  it("should clear the request but change nothing on a non-harvestable tile", () => {
    const harness = createHarness(TileType.WATER);
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.overrides).toHaveLength(0);
    expect(harness.stats.energy).toBe(harness.stats.maxEnergy);
    expect(harness.interaction.interactRequested).toBe(false);
  });

  it("should do nothing when energy is insufficient", () => {
    const harness = createHarness(TileType.FOREST);
    harness.stats.energy = 1;
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "wood")).toBe(0);
    expect(harness.overrides).toHaveLength(0);
    expect(harness.stats.energy).toBe(1);
  });

  it("should not consume the tile when the inventory is full", () => {
    const harness = createHarness(TileType.FOREST);
    for (let slot = 0; slot < harness.inventory.slots.length; slot++) {
      addItem(harness.inventory, "stone", ITEM_DEFINITIONS.stone.stackSize);
    }
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "wood")).toBe(0);
    expect(harness.overrides).toHaveLength(0);
    expect(harness.tileQuery.getTileAt(TARGET_TILE_X, PLAYER_TILE)).toBe(
      TileType.FOREST,
    );
  });

  it("should harvest the tile the entity faces, not the one it stands on", () => {
    const harness = createHarness(TileType.FOREST);
    harness.tileQuery.tiles.set(getTileKey(PLAYER_TILE, PLAYER_TILE), TileType.STONE);
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "wood")).toBe(1);
    expect(countItem(harness.inventory, "stone")).toBe(0);
  });
});
