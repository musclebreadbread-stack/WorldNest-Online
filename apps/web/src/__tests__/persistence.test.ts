import { describe, it, expect, vi } from "vitest";
import {
  InventoryComponent,
  QuestComponent,
  TileType,
  addItem,
  countItem,
  cropEntityId,
  getTileKey,
  structureEntityId,
} from "@worldnest/game-engine";
import type {
  CropComponent,
  QuestEntry,
  WalletComponent,
} from "@worldnest/game-engine";
import { INVENTORY_SLOTS, STARTING_COINS, TILE_SIZE } from "@worldnest/shared";
import { SaveScheduler } from "../lib/persistence";
import {
  parsePersistedInventory,
  restoreInventory,
  toPersistedInventory,
} from "../lib/inventorySnapshot";
import {
  parsePersistedQuests,
  restoreQuests,
  toPersistedQuests,
} from "../lib/questSnapshot";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  STARTING_WHEAT_SEEDS,
  type SavedWorldState,
} from "../game/createGameWorld";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

/** A clock the test drives by hand, so the interval rules are deterministic. */
function fakeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("SaveScheduler", () => {
  it("should not save while nothing is dirty", () => {
    const clock = fakeClock();
    const save = vi.fn();
    const scheduler = new SaveScheduler(save, 1000, clock.now);

    clock.advance(10_000);
    scheduler.tick();

    expect(save).not.toHaveBeenCalled();
  });

  it("should save at most once per interval no matter how often it is marked", () => {
    const clock = fakeClock();
    const save = vi.fn();
    const scheduler = new SaveScheduler(save, 1000, clock.now);

    clock.advance(1000);
    for (let frame = 0; frame < 50; frame++) {
      scheduler.markDirty();
      scheduler.tick();
    }

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("should save again once the interval has elapsed", () => {
    const clock = fakeClock();
    const save = vi.fn();
    const scheduler = new SaveScheduler(save, 1000, clock.now);

    scheduler.markDirty();
    clock.advance(1000);
    scheduler.tick();

    scheduler.markDirty();
    clock.advance(999);
    scheduler.tick();
    expect(save).toHaveBeenCalledTimes(1);

    clock.advance(1);
    scheduler.tick();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("should flush pending state immediately, ignoring the interval", () => {
    const clock = fakeClock();
    const save = vi.fn();
    const scheduler = new SaveScheduler(save, 10_000, clock.now);

    scheduler.markDirty();
    scheduler.flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(scheduler.isDirty).toBe(false);
  });

  it("should not flush when there is nothing pending", () => {
    const save = vi.fn();
    const scheduler = new SaveScheduler(save, 10_000, fakeClock().now);

    scheduler.flush();

    expect(save).not.toHaveBeenCalled();
  });
});

describe("inventory snapshots", () => {
  it("should round-trip an inventory through save and restore", () => {
    const source = new InventoryComponent();
    addItem(source, "wood", 12);
    addItem(source, "fence", 3);

    const restored = new InventoryComponent();
    restoreInventory(restored, toPersistedInventory(source));

    expect(restored.slots).toEqual(source.slots);
    expect(restored.selectedSlot).toBe(source.selectedSlot);
  });

  it("should treat the schema's empty default as no saved inventory", () => {
    expect(parsePersistedInventory({})).toBeNull();
    expect(parsePersistedInventory(null)).toBeNull();
    expect(parsePersistedInventory("wood")).toBeNull();
  });

  it("should drop slots that are no longer valid", () => {
    const parsed = parsePersistedInventory({
      slots: [
        { itemId: "wood", quantity: 4 },
        { itemId: "unobtainium", quantity: 4 },
        { itemId: "stone", quantity: 0 },
        "nonsense",
      ],
      selectedSlot: 1,
    })!;

    expect(parsed.slots).toEqual([{ itemId: "wood", quantity: 4 }, null, null, null]);
  });

  it("should replace the existing slots rather than add to them", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wheat_seed", STARTING_WHEAT_SEEDS);
    const versionBefore = inventory.version;

    restoreInventory(inventory, {
      slots: [{ itemId: "wood", quantity: 2 }],
      selectedSlot: 99,
    });

    expect(countItem(inventory, "wheat_seed")).toBe(0);
    expect(countItem(inventory, "wood")).toBe(2);
    expect(inventory.slots).toHaveLength(INVENTORY_SLOTS);
    // selectedSlot is clamped, and the HUD needs the version bump to notice
    expect(inventory.selectedSlot).toBe(INVENTORY_SLOTS - 1);
    expect(inventory.version).toBeGreaterThan(versionBefore);
  });
});

describe("quest snapshots", () => {
  it("should round-trip a quest log through save and restore", () => {
    const source = new QuestComponent();
    source.entries = {
      collect_wood: { state: "active", progress: 3 },
      greet_pip: { state: "completed", progress: 1 },
    };

    const restored = new QuestComponent();
    restoreQuests(restored, parsePersistedQuests(toPersistedQuests(source))!);

    expect(restored.entries).toEqual(source.entries);
    // The HUD publishes on the version, so a restore has to move it
    expect(restored.version).toBeGreaterThan(0);
  });

  it("should treat an empty quest table as nothing saved", () => {
    expect(parsePersistedQuests([])).toBeNull();
    expect(parsePersistedQuests(null)).toBeNull();
    expect(parsePersistedQuests(undefined)).toBeNull();
  });

  it("should drop a quest id the catalogue no longer knows", () => {
    const parsed = parsePersistedQuests([
      { questId: "collect_wood", state: "active", progress: 2 },
      { questId: "slay_the_dragon", state: "active", progress: 99 },
    ]);

    expect(parsed).toEqual({ collect_wood: { state: "active", progress: 2 } });
  });

  it("should drop a row whose state or progress is not usable", () => {
    expect(
      parsePersistedQuests([
        { questId: "collect_wood", state: "abandoned", progress: 1 },
      ]),
    ).toBeNull();
    expect(
      parsePersistedQuests([
        { questId: "collect_wood", state: "active", progress: Number.NaN },
      ]),
    ).toBeNull();
  });

  it("should clamp a negative progress rather than restore it", () => {
    const parsed = parsePersistedQuests([
      { questId: "collect_wood", state: "active", progress: -4.7 },
    ]);

    expect(parsed).toEqual({ collect_wood: { state: "active", progress: 0 } });
  });

  it("should replace the existing entries rather than merge into them", () => {
    const quests = new QuestComponent();
    quests.entries = { greet_pip: { state: "active", progress: 0 } };

    restoreQuests(quests, { collect_wood: { state: "completed", progress: 5 } });

    expect(Object.keys(quests.entries)).toEqual(["collect_wood"]);
  });
});

describe("progression restore in createGameWorld", () => {
  function bootWith(quests?: Record<string, QuestEntry> | null, coins?: number | null) {
    const { playerEntity } = createGameWorld({ ...BOOTSTRAP, coins, quests });
    return {
      coins: playerEntity.getComponent<WalletComponent>("wallet")!.coins,
      quests: playerEntity.getComponent<QuestComponent>("quest")!,
    };
  }

  it("should grant the starting coins when nothing was saved", () => {
    expect(bootWith(null, null).coins).toBe(STARTING_COINS);
  });

  it("should restore a saved balance instead of granting the starting coins", () => {
    expect(bootWith(null, 137).coins).toBe(137);
  });

  it("should not re-grant the starting coins to a player who spent them all", () => {
    // 0 is a balance a player can genuinely reach; `loadSession` is what decides
    // whether the column default means "never saved".
    expect(bootWith(null, 0).coins).toBe(0);
  });

  it("should start with an empty quest log when nothing was saved", () => {
    const { quests } = bootWith(null, null);

    expect(quests.entries).toEqual({});
    expect(quests.version).toBe(0);
  });

  it("should restore a saved quest log", () => {
    const { quests } = bootWith({ collect_wood: { state: "active", progress: 4 } }, 10);

    expect(quests.entries).toEqual({ collect_wood: { state: "active", progress: 4 } });
  });
});

describe("session restore in createGameWorld", () => {
  // Tile (20, 14) is grass with grass to its west for WORLD_SEED
  const STAND_TILE_X = 20;
  const STAND_TILE_Y = 14;
  const CROP_TILE_X = STAND_TILE_X - 1;
  const FENCE_TILE_X = STAND_TILE_X - 2;

  const SAVED_WORLD: SavedWorldState = {
    tileOverrides: [[getTileKey(CROP_TILE_X, STAND_TILE_Y), TileType.FARMLAND]],
    structures: [{ itemId: "fence", tileX: FENCE_TILE_X, tileY: STAND_TILE_Y }],
    crops: [
      {
        itemId: "wheat_seed",
        tileX: CROP_TILE_X,
        tileY: STAND_TILE_Y,
        plantedAtMinute: 120,
      },
    ],
  };

  function createRestoredWorld(savedWorld: SavedWorldState | null = SAVED_WORLD) {
    return createGameWorld({
      ...BOOTSTRAP,
      spawnX: STAND_TILE_X * TILE_SIZE + TILE_SIZE / 2,
      spawnY: STAND_TILE_Y * TILE_SIZE + TILE_SIZE / 2,
      savedWorld,
    });
  }

  it("should restore a saved inventory instead of granting the starting kit", () => {
    const { playerEntity } = createGameWorld({
      ...BOOTSTRAP,
      inventory: { slots: [{ itemId: "wheat", quantity: 7 }], selectedSlot: 0 },
    });
    const inventory = playerEntity.getComponent<InventoryComponent>("inventory")!;

    expect(countItem(inventory, "wheat")).toBe(7);
    expect(countItem(inventory, "wheat_seed")).toBe(0);
  });

  it("should apply saved terrain before the first chunk load", () => {
    const context = createRestoredWorld();

    expect(context.worldManager.getTileAt(CROP_TILE_X, STAND_TILE_Y)).toBe(
      TileType.FARMLAND,
    );
  });

  it("should respawn saved crops with their original planting time", () => {
    const context = createRestoredWorld();
    const entity = context.world.getEntity(cropEntityId(CROP_TILE_X, STAND_TILE_Y));

    expect(entity).toBeDefined();
    expect(entity!.getComponent<CropComponent>("crop")!.plantedAtMinute).toBe(120);
    expect(context.systems.plant.getCropAt(CROP_TILE_X, STAND_TILE_Y)).toBe(entity);
  });

  it("should respawn saved structures without charging the player", () => {
    const context = createRestoredWorld();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    expect(
      context.world.getEntity(structureEntityId(FENCE_TILE_X, STAND_TILE_Y)),
    ).toBeDefined();
    expect(context.systems.build.hasStructureAt(FENCE_TILE_X, STAND_TILE_Y)).toBe(true);
    expect(countItem(inventory, "fence")).toBe(0);
  });

  it("should leave the world untouched when there is nothing saved", () => {
    const context = createRestoredWorld(null);

    expect(context.worldManager.getTileOverrides().size).toBe(0);
    expect(context.systems.build.getStructures().size).toBe(0);
    expect(context.systems.plant.getCrops().size).toBe(0);
  });
});
