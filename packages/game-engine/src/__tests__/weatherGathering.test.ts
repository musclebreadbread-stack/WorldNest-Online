import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { WeatherGatheringComponent } from "../components/WeatherGatheringComponent";
import { EnvironmentComponent } from "../components/EnvironmentComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { PositionComponent } from "../components/PositionComponent";
import { WeatherGatheringSystem } from "../systems/WeatherGatheringSystem";
import {
  canGatherWeatherItem,
  rollWeatherGather,
  getAvailableWeatherItems,
  calculateWeatherItemValue,
  recordWeatherGather,
  pushWeatherNotification,
  getTotalWeatherItemsGathered,
  getDistinctWeatherTypesGathered,
} from "../gathering/weatherGatheringOps";
import {
  WEATHER_GATHER_COOLDOWN_MS,
  WEATHER_GATHER_TABLE,
} from "../gathering/weatherGatheringDefinitions";
import { checkCondition } from "../achievements/achievementOps";
import { countItem } from "../inventory";
import type { AchievementSource } from "../achievements/achievementDefinitions";
import type { WeatherGatheringState } from "../gathering/weatherGatheringOps";

function createWeatherGatheringState(): WeatherGatheringState {
  return {
    gatheredItems: new Map(),
    weatherNotifications: [],
    lastGatherTime: 0,
    currentWeatherDuration: 0,
    version: 0,
  };
}

function createGatherer() {
  const wg = new WeatherGatheringComponent();
  const env = new EnvironmentComponent();
  const inventory = new InventoryComponent(20);
  const position = new PositionComponent();
  const entity = new Entity("gatherer");
  entity
    .addComponent(wg)
    .addComponent(env)
    .addComponent(inventory)
    .addComponent(position);
  return { entity, wg, env, inventory };
}

describe("weatherGatheringOps", () => {
  describe("canGatherWeatherItem", () => {
    it("returns true when weather has items and cooldown expired", () => {
      expect(canGatherWeatherItem("rain", 0, WEATHER_GATHER_COOLDOWN_MS + 1)).toBe(
        true,
      );
    });

    it("returns false when cooldown not expired", () => {
      expect(canGatherWeatherItem("rain", 1000, 2000)).toBe(false);
    });

    it("returns false when weather is null", () => {
      expect(canGatherWeatherItem(null, 0, 50000)).toBe(false);
    });

    it("returns false when weather has no gatherable items", () => {
      expect(canGatherWeatherItem("clear", 0, WEATHER_GATHER_COOLDOWN_MS + 1)).toBe(
        false,
      );
    });

    it("allows gathering for storm weather", () => {
      expect(canGatherWeatherItem("storm", 0, WEATHER_GATHER_COOLDOWN_MS + 1)).toBe(
        true,
      );
    });

    it("allows gathering for aurora weather", () => {
      expect(canGatherWeatherItem("aurora", 0, WEATHER_GATHER_COOLDOWN_MS + 1)).toBe(
        true,
      );
    });
  });

  describe("rollWeatherGather", () => {
    it("returns item when roll is below chance threshold", () => {
      const result = rollWeatherGather("rain", 0.01);
      expect(result).not.toBeNull();
      expect(result!.itemId).toBe("rain_mushroom");
    });

    it("returns null when roll is above all thresholds", () => {
      const result = rollWeatherGather("rain", 0.99);
      expect(result).toBeNull();
    });

    it("returns null for weather with no items", () => {
      const result = rollWeatherGather("clear", 0.01);
      expect(result).toBeNull();
    });

    it("returns storm_fossil for storm weather with low roll", () => {
      const result = rollWeatherGather("storm", 0.01);
      expect(result).not.toBeNull();
      expect(result!.itemId).toBe("storm_fossil");
    });

    it("returns aurora_gem for aurora weather with low roll", () => {
      const result = rollWeatherGather("aurora", 0.01);
      expect(result).not.toBeNull();
      expect(result!.itemId).toBe("aurora_gem");
    });
  });

  describe("getAvailableWeatherItems", () => {
    it("returns items for rain weather", () => {
      const items = getAvailableWeatherItems("rain");
      expect(items).toHaveLength(1);
      expect(items[0].itemId).toBe("rain_mushroom");
    });

    it("returns items for snow weather", () => {
      const items = getAvailableWeatherItems("snow");
      expect(items).toHaveLength(1);
      expect(items[0].itemId).toBe("snow_crystal");
    });

    it("returns empty for clear weather", () => {
      expect(getAvailableWeatherItems("clear")).toHaveLength(0);
    });

    it("returns empty for null weather", () => {
      expect(getAvailableWeatherItems(null)).toHaveLength(0);
    });

    it("returns items for all gatherable weather types", () => {
      expect(getAvailableWeatherItems("storm")).toHaveLength(1);
      expect(getAvailableWeatherItems("wind")).toHaveLength(1);
      expect(getAvailableWeatherItems("aurora")).toHaveLength(1);
    });
  });

  describe("calculateWeatherItemValue", () => {
    it("returns base rarity when duration is 0", () => {
      expect(calculateWeatherItemValue(2, 0)).toBe(2);
    });

    it("increases value with duration", () => {
      const value = calculateWeatherItemValue(2, 150_000);
      expect(value).toBeGreaterThan(2);
      expect(value).toBe(2 * 1.5);
    });

    it("caps duration bonus at 2x", () => {
      const value = calculateWeatherItemValue(3, 1_000_000);
      expect(value).toBe(3 * 2);
    });
  });

  describe("recordWeatherGather", () => {
    it("records item and updates state", () => {
      const state = createWeatherGatheringState();
      recordWeatherGather(state, "rain_mushroom", 5000);
      expect(state.gatheredItems.get("rain_mushroom")).toBe(1);
      expect(state.lastGatherTime).toBe(5000);
      expect(state.version).toBe(1);
    });

    it("increments count for same item", () => {
      const state = createWeatherGatheringState();
      recordWeatherGather(state, "rain_mushroom", 5000);
      recordWeatherGather(state, "rain_mushroom", 40000);
      expect(state.gatheredItems.get("rain_mushroom")).toBe(2);
    });
  });

  describe("pushWeatherNotification", () => {
    it("pushes notification for gatherable weather", () => {
      const state = createWeatherGatheringState();
      const result = pushWeatherNotification(state, "rain", 1000);
      expect(result).toBe(true);
      expect(state.weatherNotifications).toHaveLength(1);
      expect(state.weatherNotifications[0].weather).toBe("rain");
      expect(state.weatherNotifications[0].availableItems).toContain("rain_mushroom");
    });

    it("does not push for non-gatherable weather", () => {
      const state = createWeatherGatheringState();
      const result = pushWeatherNotification(state, "clear", 1000);
      expect(result).toBe(false);
      expect(state.weatherNotifications).toHaveLength(0);
    });
  });

  describe("getTotalWeatherItemsGathered", () => {
    it("counts all gathered items", () => {
      const state = createWeatherGatheringState();
      recordWeatherGather(state, "rain_mushroom", 1000);
      recordWeatherGather(state, "snow_crystal", 2000);
      recordWeatherGather(state, "rain_mushroom", 3000);
      expect(getTotalWeatherItemsGathered(state)).toBe(3);
    });
  });

  describe("getDistinctWeatherTypesGathered", () => {
    it("counts distinct types from weather-exclusive list", () => {
      const state = createWeatherGatheringState();
      recordWeatherGather(state, "rain_mushroom", 1000);
      recordWeatherGather(state, "snow_crystal", 2000);
      expect(getDistinctWeatherTypesGathered(state)).toBe(2);
    });

    it("returns 5 when all types gathered", () => {
      const state = createWeatherGatheringState();
      recordWeatherGather(state, "rain_mushroom", 1000);
      recordWeatherGather(state, "snow_crystal", 2000);
      recordWeatherGather(state, "storm_fossil", 3000);
      recordWeatherGather(state, "wind_feather", 4000);
      recordWeatherGather(state, "aurora_gem", 5000);
      expect(getDistinctWeatherTypesGathered(state)).toBe(5);
    });
  });
});

describe("WeatherGatheringSystem", () => {
  let system: WeatherGatheringSystem;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 50000;
    system = new WeatherGatheringSystem(
      () => currentTime,
      () => 0.01,
    );
  });

  it("requires weatherGathering, environment, inventory, and position", () => {
    expect(system.requiredComponents).toEqual([
      "weatherGathering",
      "environment",
      "inventory",
      "position",
    ]);
  });

  it("pushes notification when weather changes to gatherable type", () => {
    const { entity, wg, env } = createGatherer();
    env.weather = "rain";
    wg.lastKnownWeather = null;
    system.update([entity], 1 / 60);
    expect(wg.weatherNotifications).toHaveLength(1);
    expect(wg.weatherNotifications[0].weather).toBe("rain");
    expect(wg.lastKnownWeather).toBe("rain");
  });

  it("does not push notification for non-gatherable weather change", () => {
    const { entity, wg, env } = createGatherer();
    env.weather = "clear";
    wg.lastKnownWeather = null;
    system.update([entity], 1 / 60);
    // pushWeatherNotification returns false for clear, so no notification
    expect(wg.weatherNotifications).toHaveLength(0);
  });

  it("tracks weather duration when weather stays the same", () => {
    const { entity, wg, env } = createGatherer();
    env.weather = "rain";
    wg.lastKnownWeather = "rain";
    system.update([entity], 1); // 1 second = 1000ms delta
    expect(wg.currentWeatherDuration).toBe(1000);
  });

  it("resets duration on weather change", () => {
    const { entity, wg, env } = createGatherer();
    wg.lastKnownWeather = "rain";
    wg.currentWeatherDuration = 5000;
    env.weather = "snow";
    system.update([entity], 1 / 60);
    expect(wg.currentWeatherDuration).toBe(0);
  });

  it("consumes pendingGather and adds item to inventory", () => {
    const { entity, wg, env, inventory } = createGatherer();
    env.weather = "rain";
    wg.lastKnownWeather = "rain";
    wg.pendingGather = true;
    wg.lastGatherTime = 0;
    system.update([entity], 1 / 60);
    expect(wg.pendingGather).toBe(false);
    expect(countItem(inventory, "rain_mushroom")).toBe(1);
    expect(wg.gatheredItems.get("rain_mushroom")).toBe(1);
  });

  it("does not gather when cooldown not expired", () => {
    const { entity, wg, env, inventory } = createGatherer();
    env.weather = "rain";
    wg.lastKnownWeather = "rain";
    wg.pendingGather = true;
    wg.lastGatherTime = currentTime - 1000; // only 1s ago
    system.update([entity], 1 / 60);
    expect(countItem(inventory, "rain_mushroom")).toBe(0);
  });

  it("does not gather when weather has no items", () => {
    const { entity, wg, env, inventory } = createGatherer();
    env.weather = "clear";
    wg.lastKnownWeather = "clear";
    wg.pendingGather = true;
    wg.lastGatherTime = 0;
    system.update([entity], 1 / 60);
    expect(countItem(inventory, "rain_mushroom")).toBe(0);
  });

  it("does not gather when roll fails", () => {
    const failSystem = new WeatherGatheringSystem(
      () => currentTime,
      () => 0.99,
    );
    const { entity, wg, env, inventory } = createGatherer();
    env.weather = "rain";
    wg.lastKnownWeather = "rain";
    wg.pendingGather = true;
    wg.lastGatherTime = 0;
    failSystem.update([entity], 1 / 60);
    expect(countItem(inventory, "rain_mushroom")).toBe(0);
  });
});

describe("Weather gathering achievement integration", () => {
  it("checks weather_items_gathered condition", () => {
    const source: AchievementSource = {
      itemCount: () => 0,
      donationCount: 0,
      structureCount: 0,
      questCompletionCount: 0,
      fishCaughtCount: 0,
      totalCoinsEarned: 0,
      animalsTamedCount: 0,
      quizStreak: 0,
      housingHappiness: 0,
      craftCount: 0,
      rhythmPerfectCount: 0,
      rhythmScore: 0,
      mountBondLevel: -1,
      waterTilesTraversed: 0,
      highestFriendshipLevel: 0,
      totalGiftsGiven: 0,
      biomesDiscovered: 0,
      landmarksDiscovered: 0,
      mapCompletionPercent: 0,
      missionsCompleted: 0,
      missionStreak: 0,
      rareItemsBought: 0,
      shopsVisited: 0,
      gardenArrangements: 0,
      gardenCompetitionWins: 0,
      weatherItemsGathered: 6,
      weatherTypesGathered: 3,
      isCategoryComplete: () => false,
    };
    expect(checkCondition({ kind: "weather_items_gathered", count: 5 }, source)).toBe(
      true,
    );
    expect(checkCondition({ kind: "weather_items_gathered", count: 10 }, source)).toBe(
      false,
    );
    expect(checkCondition({ kind: "weather_types_gathered", count: 3 }, source)).toBe(
      true,
    );
    expect(checkCondition({ kind: "weather_types_gathered", count: 5 }, source)).toBe(
      false,
    );
  });
});

describe("WEATHER_GATHER_TABLE", () => {
  it("maps each weather kind to correct items", () => {
    expect(WEATHER_GATHER_TABLE["rain"]).toHaveLength(1);
    expect(WEATHER_GATHER_TABLE["rain"][0].itemId).toBe("rain_mushroom");
    expect(WEATHER_GATHER_TABLE["snow"]).toHaveLength(1);
    expect(WEATHER_GATHER_TABLE["snow"][0].itemId).toBe("snow_crystal");
    expect(WEATHER_GATHER_TABLE["storm"]).toHaveLength(1);
    expect(WEATHER_GATHER_TABLE["storm"][0].itemId).toBe("storm_fossil");
    expect(WEATHER_GATHER_TABLE["wind"]).toHaveLength(1);
    expect(WEATHER_GATHER_TABLE["wind"][0].itemId).toBe("wind_feather");
    expect(WEATHER_GATHER_TABLE["aurora"]).toHaveLength(1);
    expect(WEATHER_GATHER_TABLE["aurora"][0].itemId).toBe("aurora_gem");
    expect(WEATHER_GATHER_TABLE["clear"]).toHaveLength(0);
    expect(WEATHER_GATHER_TABLE["fog"]).toHaveLength(0);
    expect(WEATHER_GATHER_TABLE["rainbow"]).toHaveLength(0);
  });
});
