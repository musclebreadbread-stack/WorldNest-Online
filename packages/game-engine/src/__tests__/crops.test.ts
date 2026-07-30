import { describe, it, expect } from "vitest";
import { TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { CropComponent } from "../components/CropComponent";
import { SpriteComponent } from "../components/SpriteComponent";
import { PlantSystem, cropEntityId } from "../systems/PlantSystem";
import { CropGrowthSystem } from "../systems/CropGrowthSystem";
import { HarvestSystem } from "../systems/HarvestSystem";
import { addItem, countItem } from "../inventory/inventoryOps";
import { CROP_DEFINITIONS, isSeed } from "../world/Crops";
import { TILE_PROPERTIES, TileType } from "../world/Tilemap";
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

const WHEAT = CROP_DEFINITIONS.wheat_seed!;

interface Harness {
  entity: Entity;
  interaction: InteractionComponent;
  inventory: InventoryComponent;
  tileQuery: FakeTileQuery;
  plant: PlantSystem;
  growth: CropGrowthSystem;
  harvest: HarvestSystem;
  /** Entities the plant system spawned, in creation order. */
  spawned: Entity[];
  removed: string[];
  nowMinutes: { value: number };
}

function createHarness(targetTile: TileType, seeds = 5): Harness {
  const tileQuery = new FakeTileQuery([[TARGET_TILE_X, PLAYER_TILE, targetTile]]);
  const spawned: Entity[] = [];
  const removed: string[] = [];
  const nowMinutes = { value: 0 };

  const interaction = new InteractionComponent("right");
  const inventory = new InventoryComponent();
  if (seeds > 0) addItem(inventory, "wheat_seed", seeds);

  const entity = new Entity("player")
    .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
    .addComponent(interaction)
    .addComponent(inventory)
    .addComponent(new StatsComponent());

  const plant = new PlantSystem(
    tileQuery,
    (tileX, tileY, tileType) => tileQuery.tiles.set(getTileKey(tileX, tileY), tileType),
    (spawnedEntity) => spawned.push(spawnedEntity),
    (entityId) => removed.push(entityId),
    () => nowMinutes.value,
  );
  const growth = new CropGrowthSystem(() => nowMinutes.value);
  const harvest = new HarvestSystem(
    tileQuery,
    (tileX, tileY, tileType) => tileQuery.tiles.set(getTileKey(tileX, tileY), tileType),
    plant,
  );

  return {
    entity,
    interaction,
    inventory,
    tileQuery,
    plant,
    growth,
    harvest,
    spawned,
    removed,
    nowMinutes,
  };
}

describe("farmland tile", () => {
  it("should be walkable, buildable and not harvestable", () => {
    const properties = TILE_PROPERTIES[TileType.FARMLAND];

    expect(properties.walkable).toBe(true);
    expect(properties.buildable).toBe(true);
    expect(properties.harvestable).toBe(false);
  });

  it("should only treat catalogued seeds as plantable", () => {
    expect(isSeed("wheat_seed")).toBe(true);
    expect(isSeed("wood")).toBe(false);
  });
});

describe("PlantSystem", () => {
  it("should require position, interaction and inventory", () => {
    const { plant, entity } = createHarness(TileType.FARMLAND);
    const partial = new Entity("prop").addComponent(new PositionComponent(0, 0));

    expect(plant.matches(entity)).toBe(true);
    expect(plant.matches(partial)).toBe(false);
  });

  it("should till the faced grass tile into farmland without spending a seed", () => {
    const harness = createHarness(TileType.GRASS);
    harness.interaction.interactRequested = true;

    harness.plant.update([harness.entity], 1 / 60);

    expect(harness.tileQuery.getTileAt(TARGET_TILE_X, PLAYER_TILE)).toBe(
      TileType.FARMLAND,
    );
    expect(countItem(harness.inventory, "wheat_seed")).toBe(5);
    expect(harness.spawned).toHaveLength(0);
    // The request is consumed, so HarvestSystem does not also act on the tile
    expect(harness.interaction.interactRequested).toBe(false);
  });

  it("should consume exactly one seed and create one crop entity on farmland", () => {
    const harness = createHarness(TileType.FARMLAND);
    harness.nowMinutes.value = 120;
    harness.interaction.interactRequested = true;

    harness.plant.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "wheat_seed")).toBe(4);
    expect(harness.spawned).toHaveLength(1);

    const cropEntity = harness.spawned[0];
    const crop = cropEntity.getComponent<CropComponent>("crop")!;
    expect(cropEntity.id).toBe(cropEntityId(TARGET_TILE_X, PLAYER_TILE));
    expect(crop.itemId).toBe("wheat_seed");
    expect(crop.plantedAtMinute).toBe(120);
    expect(crop.stage).toBe(0);
    expect(harness.plant.getCropAt(TARGET_TILE_X, PLAYER_TILE)).toBe(cropEntity);

    const position = cropEntity.getComponent<PositionComponent>("position")!;
    expect(position.x).toBe(TARGET_TILE_X * TILE_SIZE + TILE_SIZE / 2);
    expect(position.y).toBe(PLAYER_TILE * TILE_SIZE + TILE_SIZE / 2);
  });

  it("should not plant twice on the same tile", () => {
    const harness = createHarness(TileType.FARMLAND);
    harness.interaction.interactRequested = true;
    harness.plant.update([harness.entity], 1 / 60);

    harness.interaction.interactRequested = true;
    harness.plant.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(1);
    expect(countItem(harness.inventory, "wheat_seed")).toBe(4);
    // Nothing happened, so the request survives for the harvest system
    expect(harness.interaction.interactRequested).toBe(true);
  });

  it("should leave the request alone when the selected item is not a seed", () => {
    const harness = createHarness(TileType.FARMLAND, 0);
    addItem(harness.inventory, "wood", 1);
    harness.interaction.interactRequested = true;

    harness.plant.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(0);
    expect(harness.interaction.interactRequested).toBe(true);
  });

  it("should not plant on a tile that is neither grass nor farmland", () => {
    const harness = createHarness(TileType.WATER);
    harness.interaction.interactRequested = true;

    harness.plant.update([harness.entity], 1 / 60);

    expect(harness.spawned).toHaveLength(0);
    expect(harness.tileQuery.getTileAt(TARGET_TILE_X, PLAYER_TILE)).toBe(
      TileType.WATER,
    );
  });
});

describe("CropGrowthSystem", () => {
  function createCropEntity(plantedAtMinute = 0): Entity {
    return new Entity("crop")
      .addComponent(
        new CropComponent(
          "wheat_seed",
          plantedAtMinute,
          WHEAT.stageCount,
          WHEAT.minutesPerStage,
          1,
          1,
        ),
      )
      .addComponent(new SpriteComponent(WHEAT.textureKey, 0, true));
  }

  it("should advance the stage with the injected clock", () => {
    let nowMinutes = 0;
    const system = new CropGrowthSystem(() => nowMinutes);
    const entity = createCropEntity();
    const crop = entity.getComponent<CropComponent>("crop")!;

    system.update([entity], 1 / 60);
    expect(crop.stage).toBe(0);

    nowMinutes = WHEAT.minutesPerStage;
    system.update([entity], 1 / 60);
    expect(crop.stage).toBe(1);

    nowMinutes = WHEAT.minutesPerStage * 2;
    system.update([entity], 1 / 60);
    expect(crop.stage).toBe(2);
  });

  it("should saturate at the last stage", () => {
    const system = new CropGrowthSystem(() => WHEAT.minutesPerStage * 1000);
    const entity = createCropEntity();

    system.update([entity], 1 / 60);

    expect(entity.getComponent<CropComponent>("crop")!.stage).toBe(
      WHEAT.stageCount - 1,
    );
  });

  it("should never go below stage 0 for a crop planted in the future", () => {
    const system = new CropGrowthSystem(() => 0);
    const entity = createCropEntity(500);

    system.update([entity], 1 / 60);

    expect(entity.getComponent<CropComponent>("crop")!.stage).toBe(0);
  });

  it("should mirror the stage onto the sprite frame for the renderer", () => {
    const system = new CropGrowthSystem(() => WHEAT.minutesPerStage * 2);
    const entity = createCropEntity();

    system.update([entity], 1 / 60);

    expect(entity.getComponent<SpriteComponent>("sprite")!.frame).toBe(2);
  });
});

describe("harvesting crops", () => {
  function plantAndGrow(minutes: number): Harness {
    const harness = createHarness(TileType.FARMLAND);
    harness.interaction.interactRequested = true;
    harness.plant.update([harness.entity], 1 / 60);

    harness.nowMinutes.value = minutes;
    harness.growth.update(harness.spawned, 1 / 60);
    return harness;
  }

  it("should yield nothing from an immature crop and keep it growing", () => {
    const harness = plantAndGrow(WHEAT.minutesPerStage);
    harness.interaction.interactRequested = true;

    harness.harvest.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, WHEAT.produceItemId)).toBe(0);
    expect(harness.removed).toHaveLength(0);
    expect(harness.plant.getCropAt(TARGET_TILE_X, PLAYER_TILE)).toBeDefined();
    expect(harness.interaction.interactRequested).toBe(false);
  });

  it("should yield produce and remove the entity when mature", () => {
    const harness = plantAndGrow(WHEAT.minutesPerStage * WHEAT.stageCount);
    harness.interaction.interactRequested = true;

    harness.harvest.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, WHEAT.produceItemId)).toBe(
      WHEAT.produceQuantity,
    );
    expect(harness.removed).toEqual([cropEntityId(TARGET_TILE_X, PLAYER_TILE)]);
    expect(harness.plant.getCropAt(TARGET_TILE_X, PLAYER_TILE)).toBeUndefined();
    // The farmland survives, so the tile can be sown again
    expect(harness.tileQuery.getTileAt(TARGET_TILE_X, PLAYER_TILE)).toBe(
      TileType.FARMLAND,
    );
  });

  it("should leave the crop in place when the produce does not fit", () => {
    const harness = plantAndGrow(WHEAT.minutesPerStage * WHEAT.stageCount);
    for (let slot = 0; slot < harness.inventory.slots.length; slot++) {
      harness.inventory.slots[slot] = { itemId: "stone", quantity: 99 };
    }
    harness.interaction.interactRequested = true;

    harness.harvest.update([harness.entity], 1 / 60);

    expect(harness.removed).toHaveLength(0);
    expect(harness.plant.getCropAt(TARGET_TILE_X, PLAYER_TILE)).toBeDefined();
  });
});
