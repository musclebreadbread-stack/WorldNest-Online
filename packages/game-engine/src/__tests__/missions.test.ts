import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { MissionComponent } from "../components/MissionComponent";
import { WalletComponent } from "../components/WalletComponent";
import { addItem } from "../inventory/inventoryOps";
import {
  DAILY_MISSIONS,
  WEEKLY_MISSIONS,
  getDailyMissionForDay,
  getMission,
  getWeeklyMissionForWeek,
  STREAK_BONUS_MULTIPLIERS,
} from "../missions/missionDefinitions";
import {
  claimMissionReward,
  completeMission,
  getActiveMissions,
  getStreakMultiplier,
  recordMissionProgress,
  refreshDailyMissions,
  refreshWeeklyMissions,
} from "../missions/missionOps";
import { MissionSystem } from "../systems/MissionSystem";

function createPlayer() {
  const mission = new MissionComponent();
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(100);
  const entity = new Entity("player");
  entity.addComponent(mission).addComponent(inventory).addComponent(wallet);
  return { entity, mission, inventory, wallet };
}

describe("missionDefinitions", () => {
  it("should define 8 daily missions", () => {
    expect(DAILY_MISSIONS).toHaveLength(8);
  });

  it("should define 4 weekly missions", () => {
    expect(WEEKLY_MISSIONS).toHaveLength(4);
  });

  it("should have unique ids for all missions", () => {
    const allIds = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].map((m) => m.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("should return deterministic daily rotation", () => {
    const day5a = getDailyMissionForDay(5);
    const day5b = getDailyMissionForDay(5);
    expect(day5a.id).toBe(day5b.id);
  });

  it("should cycle through all daily missions", () => {
    const seen = new Set<string>();
    for (let day = 0; day < DAILY_MISSIONS.length; day++) {
      seen.add(getDailyMissionForDay(day).id);
    }
    expect(seen.size).toBe(DAILY_MISSIONS.length);
  });

  it("should return deterministic weekly rotation", () => {
    const week3a = getWeeklyMissionForWeek(3);
    const week3b = getWeeklyMissionForWeek(3);
    expect(week3a.id).toBe(week3b.id);
  });

  it("should cycle through all weekly missions", () => {
    const seen = new Set<string>();
    for (let week = 0; week < WEEKLY_MISSIONS.length; week++) {
      seen.add(getWeeklyMissionForWeek(week).id);
    }
    expect(seen.size).toBe(WEEKLY_MISSIONS.length);
  });

  it("should look up missions by id", () => {
    const m = getMission("daily_fish");
    expect(m).toBeDefined();
    expect(m!.tier).toBe("DAILY");
  });
});

describe("missionOps", () => {
  let mission: MissionComponent;
  let wallet: WalletComponent;

  beforeEach(() => {
    const p = createPlayer();
    mission = p.mission;
    wallet = p.wallet;
  });

  describe("refreshDailyMissions", () => {
    it("should add the daily mission for the given day", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      expect(mission.activeMissions[daily.id]).toBeDefined();
      expect(mission.lastRefreshDay).toBe(0);
    });

    it("should not refresh again on the same day", () => {
      refreshDailyMissions(mission, 5);
      const v = mission.version;
      const result = refreshDailyMissions(mission, 5);
      expect(result).toBe(false);
      expect(mission.version).toBe(v);
    });

    it("should reset streak if yesterday was not completed", () => {
      mission.dailyStreak = 3;
      mission.lastCompletedDay = 2;
      refreshDailyMissions(mission, 5);
      expect(mission.dailyStreak).toBe(0);
    });

    it("should bump streak if yesterday was completed", () => {
      mission.dailyStreak = 1;
      mission.lastCompletedDay = 4;
      refreshDailyMissions(mission, 5);
      expect(mission.dailyStreak).toBe(2);
    });
  });

  describe("refreshWeeklyMissions", () => {
    it("should add the weekly mission for the given week", () => {
      refreshWeeklyMissions(mission, 2);
      const weekly = getWeeklyMissionForWeek(2);
      expect(mission.activeMissions[weekly.id]).toBeDefined();
      expect(mission.lastRefreshWeek).toBe(2);
    });

    it("should not refresh again on the same week", () => {
      refreshWeeklyMissions(mission, 1);
      const v = mission.version;
      const result = refreshWeeklyMissions(mission, 1);
      expect(result).toBe(false);
      expect(mission.version).toBe(v);
    });
  });

  describe("recordMissionProgress", () => {
    it("should increment progress by delta", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      recordMissionProgress(mission, daily.id, 2);
      expect(mission.activeMissions[daily.id].progress).toBe(2);
    });

    it("should not exceed the objective count", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      const count = daily.objective.count;
      recordMissionProgress(mission, daily.id, count + 10);
      expect(mission.activeMissions[daily.id].progress).toBe(count);
    });

    it("should not record progress on completed missions", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      const count = daily.objective.count;
      recordMissionProgress(mission, daily.id, count);
      completeMission(mission, daily.id, 0);
      const result = recordMissionProgress(mission, daily.id, 1);
      expect(result).toBe(false);
    });
  });

  describe("completeMission", () => {
    it("should mark the mission as completed", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      recordMissionProgress(mission, daily.id, daily.objective.count);
      completeMission(mission, daily.id, 0);
      expect(mission.activeMissions[daily.id].completed).toBe(true);
    });

    it("should not complete if progress is insufficient", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      const result = completeMission(mission, daily.id, 0);
      expect(result).toBe(false);
    });

    it("should set lastCompletedDay for daily missions", () => {
      refreshDailyMissions(mission, 7);
      const daily = getDailyMissionForDay(7);
      recordMissionProgress(mission, daily.id, daily.objective.count);
      completeMission(mission, daily.id, 7);
      expect(mission.lastCompletedDay).toBe(7);
    });

    it("should increment totalMissionsCompleted lifetime counter", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      recordMissionProgress(mission, daily.id, daily.objective.count);
      expect(mission.totalMissionsCompleted).toBe(0);
      completeMission(mission, daily.id, 0);
      expect(mission.totalMissionsCompleted).toBe(1);
    });

    it("should preserve totalMissionsCompleted across day refresh", () => {
      refreshDailyMissions(mission, 0);
      const daily0 = getDailyMissionForDay(0);
      recordMissionProgress(mission, daily0.id, daily0.objective.count);
      completeMission(mission, daily0.id, 0);
      expect(mission.totalMissionsCompleted).toBe(1);

      // Refresh to next day removes the completed mission entry
      refreshDailyMissions(mission, 1);
      expect(mission.activeMissions[daily0.id]).toBeUndefined();
      // But the lifetime counter persists
      expect(mission.totalMissionsCompleted).toBe(1);
    });
  });

  describe("claimMissionReward", () => {
    it("should pay base coins with no streak", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      recordMissionProgress(mission, daily.id, daily.objective.count);
      completeMission(mission, daily.id, 0);
      const before = wallet.coins;
      claimMissionReward(mission, daily.id, wallet);
      expect(wallet.coins - before).toBe(daily.baseRewardCoins);
    });

    it("should apply streak multiplier", () => {
      mission.dailyStreak = 3;
      refreshDailyMissions(mission, 10);
      const daily = getDailyMissionForDay(10);
      recordMissionProgress(mission, daily.id, daily.objective.count);
      completeMission(mission, daily.id, 10);
      const before = wallet.coins;
      claimMissionReward(mission, daily.id, wallet);
      const expected = Math.floor(daily.baseRewardCoins * 2.0);
      expect(wallet.coins - before).toBe(expected);
    });

    it("should not allow double claim", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      recordMissionProgress(mission, daily.id, daily.objective.count);
      completeMission(mission, daily.id, 0);
      claimMissionReward(mission, daily.id, wallet);
      const before = wallet.coins;
      const result = claimMissionReward(mission, daily.id, wallet);
      expect(result).toBe(false);
      expect(wallet.coins).toBe(before);
    });

    it("should not claim uncompleted mission", () => {
      refreshDailyMissions(mission, 0);
      const daily = getDailyMissionForDay(0);
      const result = claimMissionReward(mission, daily.id, wallet);
      expect(result).toBe(false);
    });
  });

  describe("getStreakMultiplier", () => {
    it("should return 1.0 for streak of 0", () => {
      expect(getStreakMultiplier(0)).toBe(1.0);
    });

    it("should return 1.25 for streak of 1", () => {
      expect(getStreakMultiplier(1)).toBe(1.25);
    });

    it("should return 1.5 for streak of 2", () => {
      expect(getStreakMultiplier(2)).toBe(1.5);
    });

    it("should return 2.0 for streak of 3+", () => {
      expect(getStreakMultiplier(3)).toBe(2.0);
      expect(getStreakMultiplier(10)).toBe(2.0);
    });

    it("should match STREAK_BONUS_MULTIPLIERS values", () => {
      expect(getStreakMultiplier(0)).toBe(STREAK_BONUS_MULTIPLIERS[0]);
      expect(getStreakMultiplier(1)).toBe(STREAK_BONUS_MULTIPLIERS[1]);
      expect(getStreakMultiplier(2)).toBe(STREAK_BONUS_MULTIPLIERS[2]);
      expect(getStreakMultiplier(3)).toBe(STREAK_BONUS_MULTIPLIERS[3]);
    });
  });

  describe("getActiveMissions", () => {
    it("should filter by tier", () => {
      refreshDailyMissions(mission, 0);
      refreshWeeklyMissions(mission, 0);
      const dailyList = getActiveMissions(mission, "DAILY");
      const weeklyList = getActiveMissions(mission, "WEEKLY");
      expect(dailyList.length).toBe(1);
      expect(weeklyList.length).toBe(1);
    });
  });
});

describe("MissionSystem", () => {
  it("should refresh missions on day change", () => {
    let day = 1;
    const system = new MissionSystem(
      () => day,
      () => 0,
    );
    const { entity, mission } = createPlayer();

    system.update([entity], 16);
    expect(mission.lastRefreshDay).toBe(1);

    day = 2;
    system.update([entity], 16);
    expect(mission.lastRefreshDay).toBe(2);
  });

  it("should refresh missions on week change", () => {
    let week = 0;
    const system = new MissionSystem(
      () => 1,
      () => week,
    );
    const { entity, mission } = createPlayer();

    system.update([entity], 16);
    expect(mission.lastRefreshWeek).toBe(0);

    week = 1;
    system.update([entity], 16);
    expect(mission.lastRefreshWeek).toBe(1);
  });

  it("should poll collect progress from inventory", () => {
    const system = new MissionSystem(
      () => 0,
      () => 0,
    );
    const { entity, mission, inventory } = createPlayer();

    system.update([entity], 16);
    // Day 0 mission is daily_gather_wood (collect wood x5)
    const daily = getDailyMissionForDay(0);
    if (daily.objective.kind === "collect") {
      addItem(inventory, daily.objective.itemId, 3);
      system.update([entity], 16);
      expect(mission.activeMissions[daily.id].progress).toBe(3);
    }
  });

  it("should handle fish caught listener progress", () => {
    // Day 2 mission is daily_fish (fish x2)
    const system = new MissionSystem(
      () => 2,
      () => 0,
    );
    const { entity, mission } = createPlayer();

    system.update([entity], 16);
    const daily = getDailyMissionForDay(2);
    expect(daily.objective.kind).toBe("fish");

    system.recordFishCaught();
    system.recordFishCaught();
    system.update([entity], 16);
    expect(mission.activeMissions[daily.id].progress).toBe(2);
    expect(mission.activeMissions[daily.id].completed).toBe(true);
  });

  it("should consume claim request and pay reward", () => {
    const system = new MissionSystem(
      () => 2,
      () => 0,
    );
    const { entity, mission, wallet } = createPlayer();

    system.update([entity], 16);
    const daily = getDailyMissionForDay(2);

    // Complete the mission
    system.recordFishCaught();
    system.recordFishCaught();
    system.update([entity], 16);

    // Claim the reward
    const before = wallet.coins;
    mission.requestedClaim = daily.id;
    system.update([entity], 16);
    expect(wallet.coins).toBeGreaterThan(before);
    expect(mission.activeMissions[daily.id].claimed).toBe(true);
  });
});
