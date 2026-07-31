import { describe, it, expect } from "vitest";
import { DAYS_PER_SEASON, WEATHER_PERIOD_MINUTES } from "@worldnest/shared";
import { Biome } from "../world/Biomes";
import { Season, seasonForDay } from "../world/Seasons";
import {
  weatherAt,
  weatherPeriodIndex,
  WEATHER_KINDS,
  type WeatherKind,
} from "../world/Weather";
import type { DayPhase } from "../world/WorldClock";

describe("seasonForDay", () => {
  it("should cycle with period 4 * DAYS_PER_SEASON", () => {
    const cycle = 4 * DAYS_PER_SEASON;
    for (let day = 1; day <= 200; day++) {
      const season = seasonForDay(day);
      expect(season).toBe(seasonForDay(day + cycle));
    }
  });

  it("should be total for days 1 through 200", () => {
    for (let day = 1; day <= 200; day++) {
      const season = seasonForDay(day);
      expect(season).toBeGreaterThanOrEqual(Season.SPRING);
      expect(season).toBeLessThanOrEqual(Season.WINTER);
    }
  });

  it("should start in spring on day 1", () => {
    expect(seasonForDay(1)).toBe(Season.SPRING);
  });

  it("should progress through all four seasons", () => {
    const seen = new Set<Season>();
    for (let day = 1; day <= 4 * DAYS_PER_SEASON; day++) {
      seen.add(seasonForDay(day));
    }
    expect(seen.size).toBe(4);
  });
});

describe("weatherPeriodIndex", () => {
  it("should increment every WEATHER_PERIOD_MINUTES", () => {
    expect(weatherPeriodIndex(0)).toBe(0);
    expect(weatherPeriodIndex(WEATHER_PERIOD_MINUTES - 1)).toBe(0);
    expect(weatherPeriodIndex(WEATHER_PERIOD_MINUTES)).toBe(1);
    expect(weatherPeriodIndex(WEATHER_PERIOD_MINUTES * 5)).toBe(5);
  });
});

describe("weatherAt", () => {
  const allBiomes = Object.values(Biome).filter(
    (v) => typeof v === "number",
  ) as Biome[];
  const allSeasons = [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER];
  const allPhases: DayPhase[] = ["dawn", "day", "dusk", "night"];

  it("should be total over every biome/season/phase combination", () => {
    for (const biome of allBiomes) {
      for (const season of allSeasons) {
        for (const phase of allPhases) {
          const kind = weatherAt(0, biome, season, phase);
          expect(
            WEATHER_KINDS.includes(kind),
            `${biome}/${season}/${phase} -> ${kind}`,
          ).toBe(true);
        }
      }
    }
  });

  it("should be deterministic for the same arguments", () => {
    for (let i = 0; i < 50; i++) {
      const a = weatherAt(i, Biome.GRASSLAND, Season.SPRING, "day");
      const b = weatherAt(i, Biome.GRASSLAND, Season.SPRING, "day");
      expect(a).toBe(b);
    }
  });

  it("should never produce snow in a desert outside winter", () => {
    for (let period = 0; period < 200; period++) {
      for (const phase of allPhases) {
        for (const season of [Season.SPRING, Season.SUMMER, Season.AUTUMN]) {
          expect(weatherAt(period, Biome.DESERT, season, phase)).not.toBe("snow");
        }
      }
    }
  });

  it("should only produce aurora at night", () => {
    for (let period = 0; period < 200; period++) {
      for (const biome of allBiomes) {
        for (const season of allSeasons) {
          for (const phase of ["dawn", "day", "dusk"] as DayPhase[]) {
            expect(weatherAt(period, biome, season, phase)).not.toBe("aurora");
          }
        }
      }
    }
  });

  it("should produce at least five distinct kinds in a 200-period sweep", () => {
    const seen = new Set<WeatherKind>();
    for (let period = 0; period < 200; period++) {
      for (const biome of allBiomes) {
        for (const season of allSeasons) {
          for (const phase of allPhases) {
            seen.add(weatherAt(period, biome, season, phase));
          }
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});
