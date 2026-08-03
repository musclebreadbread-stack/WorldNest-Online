import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { FestivalComponent } from "../components/FestivalComponent";
import { WalletComponent } from "../components/WalletComponent";
import { TimeComponent } from "../components/TimeComponent";
import { WorldClock } from "../world/WorldClock";
import {
  FESTIVAL_DEFINITIONS,
  FESTIVAL_IDS,
  getFestival,
} from "../festivals/festivalDefinitions";
import {
  dayOfSeason,
  getActiveFestival,
  isFestivalActive,
  getCycleKey,
  getCycleNumber,
  claimFestivalReward,
  getFestivalProgress,
} from "../festivals/festivalOps";
import { FestivalSystem } from "../systems/FestivalSystem";
import { DAYS_PER_SEASON } from "@worldnest/shared";

/** Convert season index + dayOfSeason to an absolute game day. */
function gameDay(season: number, dos: number): number {
  return season * DAYS_PER_SEASON + dos;
}

function createPlayer() {
  const festival = new FestivalComponent();
  const wallet = new WalletComponent(0);
  const time = new TimeComponent(WorldClock.fromWallClock(Date.now()));
  const entity = new Entity("player");
  entity.addComponent(festival).addComponent(wallet).addComponent(time);
  return { entity, festival, wallet, time };
}

describe("festivalDefinitions", () => {
  it("should define 4 festivals with valid keys and unique ids", () => {
    expect(FESTIVAL_IDS).toHaveLength(4);
    expect(new Set(FESTIVAL_IDS).size).toBe(4);
    for (const def of FESTIVAL_DEFINITIONS) {
      expect(def.titleKey).toMatch(/^festival\./);
      expect(def.descriptionKey).toMatch(/^festival\./);
      expect(def.rewardCoins).toBeGreaterThan(0);
      expect(def.durationDays).toBeGreaterThanOrEqual(1);
    }
  });

  it("should look up festivals by id", () => {
    expect(getFestival("blossom_fest")).toBeDefined();
    expect(getFestival("harvest_moon")).toBeDefined();
    expect(getFestival("mushroom_fair")).toBeDefined();
    expect(getFestival("starlight_night")).toBeDefined();
    expect(getFestival("nonexistent")).toBeUndefined();
  });
});

describe("dayOfSeason", () => {
  it("should return 1-based day within season", () => {
    expect(dayOfSeason(1)).toBe(1);
    expect(dayOfSeason(7)).toBe(7);
    expect(dayOfSeason(8)).toBe(1);
    expect(dayOfSeason(14)).toBe(7);
    expect(dayOfSeason(15)).toBe(1);
    expect(dayOfSeason(28)).toBe(7);
  });

  it("should wrap around after a full cycle", () => {
    expect(dayOfSeason(29)).toBe(1);
    expect(dayOfSeason(56)).toBe(7);
  });
});

describe("getActiveFestival", () => {
  it("should activate blossom_fest on spring days 3-4", () => {
    expect(getActiveFestival(gameDay(0, 3))!.id).toBe("blossom_fest");
    expect(getActiveFestival(gameDay(0, 4))!.id).toBe("blossom_fest");
  });

  it("should deactivate blossom_fest after duration", () => {
    expect(getActiveFestival(gameDay(0, 5))).toBeNull();
  });

  it("should activate harvest_moon on summer days 5-6", () => {
    expect(getActiveFestival(gameDay(1, 5))!.id).toBe("harvest_moon");
    expect(getActiveFestival(gameDay(1, 6))!.id).toBe("harvest_moon");
  });

  it("should activate mushroom_fair on autumn day 2", () => {
    expect(getActiveFestival(gameDay(2, 2))!.id).toBe("mushroom_fair");
  });

  it("should activate starlight_night on winter day 6 only", () => {
    expect(getActiveFestival(gameDay(3, 6))!.id).toBe("starlight_night");
    expect(getActiveFestival(gameDay(3, 7))).toBeNull();
  });

  it("should return null on off-days", () => {
    expect(getActiveFestival(gameDay(0, 1))).toBeNull();
    expect(getActiveFestival(gameDay(0, 7))).toBeNull();
    expect(getActiveFestival(gameDay(1, 1))).toBeNull();
    expect(getActiveFestival(gameDay(3, 1))).toBeNull();
  });
});

describe("isFestivalActive", () => {
  it("should return true for the correct festival on active day", () => {
    expect(isFestivalActive(gameDay(0, 3), "blossom_fest")).toBe(true);
    expect(isFestivalActive(gameDay(1, 5), "harvest_moon")).toBe(true);
  });

  it("should return false for wrong festival or off-day", () => {
    expect(isFestivalActive(gameDay(0, 3), "harvest_moon")).toBe(false);
    expect(isFestivalActive(gameDay(0, 1), "blossom_fest")).toBe(false);
  });
});

describe("getCycleKey and getCycleNumber", () => {
  it("should produce correct cycle numbers", () => {
    expect(getCycleNumber(1)).toBe(0);
    expect(getCycleNumber(28)).toBe(0);
    expect(getCycleNumber(29)).toBe(1);
    expect(getCycleNumber(56)).toBe(1);
  });

  it("should produce unique keys per cycle", () => {
    const key1 = getCycleKey(3, "blossom_fest");
    const key2 = getCycleKey(31, "blossom_fest");
    expect(key1).toBe("blossom_fest:0");
    expect(key2).toBe("blossom_fest:1");
    expect(key1).not.toBe(key2);
  });
});

describe("claimFestivalReward", () => {
  it("should pay reward coins to wallet", () => {
    const { festival, wallet } = createPlayer();
    const result = claimFestivalReward(festival, wallet, "blossom_fest", 3, 40);
    expect(result).toBe(true);
    expect(wallet.coins).toBe(40);
    expect(festival.version).toBe(1);
  });

  it("should prevent double-claim within same cycle", () => {
    const { festival, wallet } = createPlayer();
    claimFestivalReward(festival, wallet, "blossom_fest", 3, 40);
    const result = claimFestivalReward(festival, wallet, "blossom_fest", 4, 40);
    expect(result).toBe(false);
    expect(wallet.coins).toBe(40);
  });

  it("should allow claim in next cycle", () => {
    const { festival, wallet } = createPlayer();
    claimFestivalReward(festival, wallet, "blossom_fest", 3, 40);
    const result = claimFestivalReward(festival, wallet, "blossom_fest", 31, 40);
    expect(result).toBe(true);
    expect(wallet.coins).toBe(80);
  });
});

describe("getFestivalProgress", () => {
  it("should return current state", () => {
    const { festival, wallet } = createPlayer();
    festival.activeFestival = "blossom_fest";
    claimFestivalReward(festival, wallet, "blossom_fest", 3, 40);
    const progress = getFestivalProgress(festival);
    expect(progress.active).toBe("blossom_fest");
    expect(progress.claimed).toContain("blossom_fest:0");
  });
});

describe("FestivalSystem", () => {
  let system: FestivalSystem;
  let currentDay: number;

  beforeEach(() => {
    currentDay = 1;
    system = new FestivalSystem(() => currentDay);
  });

  it("should require festival, wallet, and time components", () => {
    expect(system.requiredComponents).toEqual(["festival", "wallet", "time"]);
  });

  it("should activate festival when day matches", () => {
    const { entity, festival } = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([entity], 1 / 60);
    expect(festival.activeFestival).toBe("blossom_fest");
    expect(festival.version).toBe(1);
  });

  it("should deactivate festival when day passes", () => {
    const { entity, festival } = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([entity], 1 / 60);
    currentDay = gameDay(0, 5);
    system.update([entity], 1 / 60);
    expect(festival.activeFestival).toBeNull();
    expect(festival.version).toBe(2);
  });

  it("should not bump version if festival did not change", () => {
    const { entity, festival } = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([entity], 1 / 60);
    system.update([entity], 1 / 60);
    expect(festival.version).toBe(1);
  });

  it("should pay reward when requestedClaim matches active festival", () => {
    const { entity, festival, wallet } = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([entity], 1 / 60);
    festival.requestedClaim = "blossom_fest";
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(40);
    expect(festival.requestedClaim).toBeNull();
  });

  it("should ignore claim if no festival is active", () => {
    const { entity, festival, wallet } = createPlayer();
    currentDay = gameDay(0, 1);
    system.update([entity], 1 / 60);
    festival.requestedClaim = "blossom_fest";
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(0);
    expect(festival.requestedClaim).toBeNull();
  });

  it("should ignore claim for wrong festival", () => {
    const { entity, festival, wallet } = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([entity], 1 / 60);
    festival.requestedClaim = "harvest_moon";
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(0);
  });

  it("should prevent double-claim in same cycle", () => {
    const { entity, festival, wallet } = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([entity], 1 / 60);
    festival.requestedClaim = "blossom_fest";
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(40);
    festival.requestedClaim = "blossom_fest";
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(40);
  });

  it("should handle multiple entities", () => {
    const p1 = createPlayer();
    const p2 = createPlayer();
    currentDay = gameDay(0, 3);
    system.update([p1.entity, p2.entity], 1 / 60);
    expect(p1.festival.activeFestival).toBe("blossom_fest");
    expect(p2.festival.activeFestival).toBe("blossom_fest");
  });
});
