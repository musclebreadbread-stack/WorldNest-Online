import { describe, it, expect } from "vitest";
import { ITEM_DEFINITIONS, TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { FishingComponent } from "../components/FishingComponent";
import { FishingSystem } from "../systems/FishingSystem";
import { addItem, countItem } from "../inventory/inventoryOps";
import { TileType } from "../world/Tilemap";
import { Biome } from "../world/Biomes";
import { getTileKey, type TileQuery } from "../world/TileQuery";
import {
  canFish,
  FISHING_ENERGY_COST,
  FISHING_WINDOW_MS,
  reelIn,
  rollCatch,
  tickFishing,
} from "../fishing";

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

const PLAYER_TILE = 4;
const PLAYER_PIXEL = PLAYER_TILE * TILE_SIZE + TILE_SIZE / 2;
const TARGET_TILE_X = PLAYER_TILE + 1;

interface Harness {
  entity: Entity;
  interaction: InteractionComponent;
  inventory: InventoryComponent;
  stats: StatsComponent;
  fishing: FishingComponent;
  tileQuery: FakeTileQuery;
  system: FishingSystem;
}

function createHarness(
  targetTile: TileType = TileType.WATER,
  biome: Biome = Biome.GRASSLAND,
  rngValues: number[] = [0.5, 0.5],
  onFishCaught?: () => void,
): Harness {
  const tileQuery = new FakeTileQuery([[TARGET_TILE_X, PLAYER_TILE, targetTile]]);
  let rngIndex = 0;
  const rng = () => rngValues[rngIndex++ % rngValues.length];
  const biomeAtTile = () => biome;

  const interaction = new InteractionComponent("right");
  const inventory = new InventoryComponent();
  const stats = new StatsComponent();
  const fishing = new FishingComponent();
  const entity = new Entity("player")
    .addComponent(new PositionComponent(PLAYER_PIXEL, PLAYER_PIXEL))
    .addComponent(interaction)
    .addComponent(inventory)
    .addComponent(stats)
    .addComponent(fishing);

  // Give the player a fishing rod
  addItem(inventory, "fishing_rod", 1);

  const system = new FishingSystem(tileQuery, biomeAtTile, rng, onFishCaught);

  return { entity, interaction, inventory, stats, fishing, tileQuery, system };
}

describe("canFish", () => {
  it("should return false without a fishing rod", () => {
    const inventory = new InventoryComponent();
    const stats = new StatsComponent();
    expect(canFish(inventory, stats, TileType.WATER)).toBe(false);
  });

  it("should return false when not facing water", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "fishing_rod", 1);
    const stats = new StatsComponent();
    expect(canFish(inventory, stats, TileType.GRASS)).toBe(false);
  });

  it("should return false when energy is insufficient", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "fishing_rod", 1);
    const stats = new StatsComponent();
    stats.energy = FISHING_ENERGY_COST - 1;
    expect(canFish(inventory, stats, TileType.WATER)).toBe(false);
  });

  it("should return true when all conditions are met", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "fishing_rod", 1);
    const stats = new StatsComponent();
    expect(canFish(inventory, stats, TileType.WATER)).toBe(true);
  });

  it("should return false when inventory is full", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "fishing_rod", 1);
    // Fill all remaining slots with stone
    for (let i = 0; i < inventory.slots.length; i++) {
      if (inventory.slots[i] === null) {
        addItem(inventory, "stone", ITEM_DEFINITIONS.stone.stackSize);
      }
    }
    const stats = new StatsComponent();
    expect(canFish(inventory, stats, TileType.WATER)).toBe(false);
  });
});

describe("rollCatch", () => {
  it("should return fish_common for grassland with low rng", () => {
    // Grassland: common=60, rare=40. rng=0 picks the first entry.
    expect(rollCatch(Biome.GRASSLAND, 0)).toBe("fish_common");
  });

  it("should return fish_rare for grassland with high rng", () => {
    // Grassland: common=60, rare=40. rng=0.99 is in the rare range.
    expect(rollCatch(Biome.GRASSLAND, 0.99)).toBe("fish_rare");
  });

  it("should return fish_tropical only from warm biomes", () => {
    // Desert: common=35, rare=30, tropical=35. Total=100.
    // rng=0.9 => roll=90, after common: 55, after rare: 25, after tropical: -10
    expect(rollCatch(Biome.DESERT, 0.9)).toBe("fish_tropical");
  });

  it("should never return fish_tropical from tundra", () => {
    // Tundra only has common and rare
    for (let i = 0; i < 100; i++) {
      const result = rollCatch(Biome.TUNDRA, i / 100);
      expect(result).not.toBe("fish_tropical");
    }
  });
});

describe("tickFishing", () => {
  it("should advance timer in waiting state", () => {
    const result = tickFishing("waiting", 0, 500, 3000);
    expect(result.state).toBe("waiting");
    expect(result.timer).toBe(500);
  });

  it("should transition to biting when timer exceeds biteTime", () => {
    const result = tickFishing("waiting", 2900, 200, 3000);
    expect(result.state).toBe("biting");
    expect(result.timer).toBe(0);
  });

  it("should transition to missed when biting timer exceeds window", () => {
    const result = tickFishing("biting", FISHING_WINDOW_MS - 100, 200, 3000);
    expect(result.state).toBe("missed");
  });

  it("should not transition biting if still within window", () => {
    const result = tickFishing("biting", 0, 500, 3000);
    expect(result.state).toBe("biting");
    expect(result.timer).toBe(500);
  });
});

describe("reelIn", () => {
  it("should return success when biting and within window", () => {
    expect(reelIn("biting", 500)).toBe("success");
  });

  it("should return too_early when still waiting", () => {
    expect(reelIn("waiting", 1000)).toBe("too_early");
  });

  it("should return too_late for other states", () => {
    expect(reelIn("idle", 0)).toBe("too_late");
    expect(reelIn("missed", 0)).toBe("too_late");
  });
});

describe("FishingSystem", () => {
  it("should require position, interaction, inventory, stats and fishing", () => {
    const { system, entity } = createHarness();
    const partial = new Entity("prop").addComponent(new PositionComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });

  it("should not consume interaction when not facing water", () => {
    const harness = createHarness(TileType.GRASS);
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    // Interaction was not consumed because not facing water
    expect(harness.interaction.interactRequested).toBe(true);
    expect(harness.fishing.state).toBe("idle");
  });

  it("should start fishing on interact when facing water with rod", () => {
    const harness = createHarness();
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.fishing.state).toBe("waiting");
    expect(harness.interaction.interactRequested).toBe(false);
  });

  it("should deduct energy on cast", () => {
    const harness = createHarness();
    const energyBefore = harness.stats.energy;
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.stats.energy).toBe(energyBefore - FISHING_ENERGY_COST);
  });

  it("should transition from waiting to biting after elapsed time", () => {
    const harness = createHarness(TileType.WATER, Biome.GRASSLAND, [0.5, 0.5]);
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Now in waiting state, advance time past biteTime
    // biteTime = 2000 + 0.5 * 3000 = 3500
    harness.system.update([harness.entity], 4); // 4000ms > 3500ms

    expect(harness.fishing.state).toBe("biting");
  });

  it("should award fish on successful reel-in during biting window", () => {
    const harness = createHarness(TileType.WATER, Biome.GRASSLAND, [0.5, 0.0]);
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Advance to biting state
    harness.system.update([harness.entity], 4); // past biteTime

    expect(harness.fishing.state).toBe("biting");

    // Reel in during the window
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(harness.fishing.state).toBe("idle"); // caught -> idle in same frame
    // rng for catch was 0.0, grassland: common=60,rare=40 => fish_common
    expect(countItem(harness.inventory, "fish_common")).toBe(1);
  });

  it("should mark as missed when biting window expires", () => {
    const harness = createHarness(TileType.WATER, Biome.GRASSLAND, [0.5, 0.5]);
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Advance to biting
    harness.system.update([harness.entity], 4);
    expect(harness.fishing.state).toBe("biting");

    // Let the window expire
    harness.system.update([harness.entity], 2); // 2000ms > 1500ms window
    // missed -> idle in the same update
    expect(harness.fishing.state).toBe("idle");
    expect(countItem(harness.inventory, "fish_common")).toBe(0);
  });

  it("should mark as missed when reeling in too early", () => {
    const harness = createHarness(TileType.WATER, Biome.GRASSLAND, [0.5, 0.5]);
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(harness.fishing.state).toBe("waiting");

    // Try to reel in while still waiting
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // missed -> idle in the same frame
    expect(harness.fishing.state).toBe("idle");
    expect(countItem(harness.inventory, "fish_common")).toBe(0);
  });

  it("should not start fishing when inventory is full", () => {
    const harness = createHarness();
    // Fill all empty slots
    for (let i = 0; i < harness.inventory.slots.length; i++) {
      if (harness.inventory.slots[i] === null) {
        addItem(harness.inventory, "stone", ITEM_DEFINITIONS.stone.stackSize);
      }
    }
    const energyBefore = harness.stats.energy;
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.fishing.state).toBe("idle");
    expect(harness.stats.energy).toBe(energyBefore);
  });

  it("should not start fishing without enough energy", () => {
    const harness = createHarness();
    harness.stats.energy = FISHING_ENERGY_COST - 1;
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 1 / 60);

    expect(harness.fishing.state).toBe("idle");
  });

  it("should vary catch by biome", () => {
    // Desert with high rng should yield tropical fish
    const harness = createHarness(TileType.WATER, Biome.DESERT, [0.5, 0.99]);
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Advance to biting
    harness.system.update([harness.entity], 4);

    // Reel in
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(countItem(harness.inventory, "fish_tropical")).toBe(1);
  });

  it("should mark as missed when inventory is full for the rolled catch type", () => {
    // Use grassland with rng=0.0 which rolls fish_common
    const harness = createHarness(TileType.WATER, Biome.GRASSLAND, [0.5, 0.0]);

    // Fill inventory so fish_common has no space, but leave a fishing rod slot
    // First clear the inventory
    harness.inventory.slots.fill(null);
    // Put the fishing rod back
    addItem(harness.inventory, "fishing_rod", 1);
    // Fill all remaining slots with fish_common at max stack
    for (let i = 0; i < harness.inventory.slots.length; i++) {
      if (harness.inventory.slots[i] === null) {
        addItem(
          harness.inventory,
          "fish_common",
          ITEM_DEFINITIONS.fish_common.stackSize,
        );
      }
    }

    // Ensure canFish still passes (there is space for rare or tropical)
    // Actually, all slots are full of fish_common at max stack, so no space
    // for any fish. canFish should fail. Let's adjust: leave one slot with
    // space for fish_rare but not fish_common.
    harness.inventory.slots.fill(null);
    addItem(harness.inventory, "fishing_rod", 1);
    // Fill remaining slots with fish_common at max stack size
    for (let i = 0; i < harness.inventory.slots.length; i++) {
      if (harness.inventory.slots[i] === null) {
        addItem(
          harness.inventory,
          "fish_common",
          ITEM_DEFINITIONS.fish_common.stackSize,
        );
      }
    }
    // Replace the last fish_common slot with fish_rare at 1 (has space for rare)
    const lastFishSlot = harness.inventory.slots.findIndex(
      (s) => s !== null && s.itemId === "fish_common",
    );
    harness.inventory.slots[lastFishSlot] = { itemId: "fish_rare", quantity: 1 };

    // Now canFish passes (there is space for fish_rare), but if the roll
    // produces fish_common there is no space for it.
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(harness.fishing.state).toBe("waiting");

    // Advance to biting
    harness.system.update([harness.entity], 4);
    expect(harness.fishing.state).toBe("biting");

    // Reel in - catch is rolled at reel-time, rng=0.0 => fish_common => no space
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Should be missed (no space for the rolled fish_common), not caught
    // Terminal states reset to idle in the same frame
    expect(harness.fishing.state).toBe("idle");
    // No fish_common was added (count should remain the same)
    const expectedCommonCount =
      (harness.inventory.slots.length - 2) * ITEM_DEFINITIONS.fish_common.stackSize;
    expect(countItem(harness.inventory, "fish_common")).toBe(expectedCommonCount);
  });

  it("should call onFishCaught listener on successful catch", () => {
    let fishCaughtCalls = 0;
    const harness = createHarness(
      TileType.WATER,
      Biome.GRASSLAND,
      [0.5, 0.0],
      () => fishCaughtCalls++,
    );
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Advance to biting
    harness.system.update([harness.entity], 4);

    // Reel in during the window
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(fishCaughtCalls).toBe(1);
  });

  it("should not call onFishCaught listener on missed catch", () => {
    let fishCaughtCalls = 0;
    const harness = createHarness(
      TileType.WATER,
      Biome.GRASSLAND,
      [0.5, 0.5],
      () => fishCaughtCalls++,
    );
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    // Try to reel in too early (still waiting)
    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 1 / 60);

    expect(fishCaughtCalls).toBe(0);
  });
});
