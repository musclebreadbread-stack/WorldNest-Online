import { describe, it, expect } from "vitest";
import { GAME_MINUTES_PER_REAL_SECOND, MAX_ENERGY } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { StatsComponent } from "../components/StatsComponent";
import { StatsSystem } from "../systems/StatsSystem";
import type { DayPhase } from "../world/WorldClock";

/** One real second of regeneration at the default rate. */
const REGEN_PER_SECOND = GAME_MINUTES_PER_REAL_SECOND;

function createEntity(energy: number): { entity: Entity; stats: StatsComponent } {
  const stats = new StatsComponent();
  stats.energy = energy;
  const entity = new Entity("player").addComponent(stats);
  return { entity, stats };
}

describe("StatsComponent", () => {
  it("should start at full health and energy", () => {
    const stats = new StatsComponent();

    expect(stats.type).toBe("stats");
    expect(stats.health).toBe(stats.maxHealth);
    expect(stats.energy).toBe(MAX_ENERGY);
    expect(stats.maxEnergy).toBe(MAX_ENERGY);
  });
});

describe("StatsSystem", () => {
  it("should only match entities with stats", () => {
    const system = new StatsSystem();
    const { entity } = createEntity(10);
    const other = new Entity("prop").addComponent(new PositionComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(other)).toBe(false);
  });

  it("should regenerate energy over time", () => {
    const system = new StatsSystem(() => "day");
    const { entity, stats } = createEntity(50);

    system.update([entity], 1);

    expect(stats.energy).toBeCloseTo(50 + REGEN_PER_SECOND, 6);
  });

  it("should regenerate at double rate at night", () => {
    let phase: DayPhase = "day";
    const system = new StatsSystem(() => phase);
    const { entity, stats } = createEntity(50);

    system.update([entity], 1);
    const dayGain = stats.energy - 50;

    phase = "night";
    const before = stats.energy;
    system.update([entity], 1);

    expect(stats.energy - before).toBeCloseTo(dayGain * 2, 6);
  });

  it("should clamp energy at the maximum", () => {
    const system = new StatsSystem(() => "night");
    const { entity, stats } = createEntity(MAX_ENERGY - 0.5);

    system.update([entity], 10);
    system.update([entity], 10);

    expect(stats.energy).toBe(MAX_ENERGY);
  });

  it("should leave health untouched", () => {
    const system = new StatsSystem();
    const { entity, stats } = createEntity(0);
    stats.health = 42;

    system.update([entity], 5);

    expect(stats.health).toBe(42);
  });
});
