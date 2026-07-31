import { describe, it, expect } from "vitest";
import { TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { AnimalComponent } from "../components/AnimalComponent";
import { AnimalSystem } from "../systems/AnimalSystem";
import {
  ANIMAL_DEFINITIONS,
  ANIMAL_SPECIES,
  canTame,
  feedAnimal,
  FOLLOW_STOP_DISTANCE,
  IDLE_WANDER_INTERVAL_MS,
  pickWanderTarget,
  rollSpawnChance,
  shouldFlee,
  tickFlee,
  tickFollow,
  tickIdle,
  tickWander,
  WANDER_RADIUS,
} from "../animals";
import { Biome } from "../world/Biomes";

describe("animalDefinitions", () => {
  it("should define at least 4 species", () => {
    expect(ANIMAL_SPECIES.length).toBeGreaterThanOrEqual(4);
  });
  it("should have valid biome associations for every species", () => {
    for (const species of ANIMAL_SPECIES) {
      const def = ANIMAL_DEFINITIONS[species];
      expect(def.biomes.length).toBeGreaterThan(0);
      for (const biome of def.biomes) {
        expect(Object.values(Biome)).toContain(biome);
      }
    }
  });
  it("should have positive tamingFeedCount for every species", () => {
    for (const species of ANIMAL_SPECIES) {
      expect(ANIMAL_DEFINITIONS[species].tamingFeedCount).toBeGreaterThan(0);
    }
  });
  it("should have positive speed for every species", () => {
    for (const species of ANIMAL_SPECIES) {
      expect(ANIMAL_DEFINITIONS[species].speed).toBeGreaterThan(0);
    }
  });
  it("should have positive fleeDistance for every species", () => {
    for (const species of ANIMAL_SPECIES) {
      expect(ANIMAL_DEFINITIONS[species].fleeDistance).toBeGreaterThan(0);
    }
  });
});

describe("canTame", () => {
  it("should return false when feedCount below threshold", () => {
    expect(canTame("rabbit", 1, null)).toBe(false);
  });
  it("should return true when feedCount meets threshold", () => {
    expect(canTame("rabbit", 2, null)).toBe(true);
  });
  it("should return false when already owned", () => {
    expect(canTame("rabbit", 10, "player1")).toBe(false);
  });
});

describe("feedAnimal", () => {
  it("should increment feed count", () => {
    const result = feedAnimal("rabbit", 0);
    expect(result.feedCount).toBe(1);
    expect(result.tamed).toBe(false);
  });
  it("should tame at threshold", () => {
    const result = feedAnimal("rabbit", 1);
    expect(result.feedCount).toBe(2);
    expect(result.tamed).toBe(true);
  });
  it("should tame deer at 4 feeds", () => {
    const result = feedAnimal("deer", 3);
    expect(result.feedCount).toBe(4);
    expect(result.tamed).toBe(true);
  });
});

describe("tickIdle", () => {
  it("should stay idle before interval", () => {
    const result = tickIdle(0, 1000);
    expect(result.behavior).toBe("idle");
    expect(result.timer).toBe(1000);
  });
  it("should transition to wander after interval", () => {
    const result = tickIdle(2500, 600);
    expect(result.behavior).toBe("wander");
    expect(result.timer).toBe(0);
  });
  it("should transition exactly at interval boundary", () => {
    const result = tickIdle(0, IDLE_WANDER_INTERVAL_MS);
    expect(result.behavior).toBe("wander");
  });
});

describe("tickWander", () => {
  it("should return true when at target", () => {
    expect(tickWander(100, 100, 100, 100, 8)).toBe(true);
  });
  it("should return true when within threshold", () => {
    expect(tickWander(100, 100, 105, 105, 8)).toBe(true);
  });
  it("should return false when far from target", () => {
    expect(tickWander(0, 0, 100, 100, 8)).toBe(false);
  });
});

describe("shouldFlee", () => {
  it("should return true when player is within flee distance", () => {
    expect(shouldFlee(5, 5, 6, 5, 3)).toBe(true);
  });
  it("should return false when player is outside flee distance", () => {
    expect(shouldFlee(5, 5, 20, 20, 3)).toBe(false);
  });
  it("should check both axes", () => {
    expect(shouldFlee(5, 5, 5, 9, 3)).toBe(false);
  });
});

describe("tickFlee", () => {
  it("should flee away from threat", () => {
    const result = tickFlee(100, 100, 90, 90);
    expect(result.vx).toBe(1);
    expect(result.vy).toBe(1);
  });
  it("should flee in negative direction", () => {
    const result = tickFlee(50, 50, 60, 60);
    expect(result.vx).toBe(-1);
    expect(result.vy).toBe(-1);
  });
  it("should handle same position", () => {
    const result = tickFlee(50, 50, 50, 50);
    expect(result.vx).toBe(0);
    expect(result.vy).toBe(0);
  });
});

describe("tickFollow", () => {
  it("should return zero velocity when close", () => {
    const result = tickFollow(100, 100, 110, 110);
    expect(result.vx).toBe(0);
    expect(result.vy).toBe(0);
  });
  it("should move toward owner when far", () => {
    const result = tickFollow(0, 0, 200, 200);
    expect(result.vx).toBe(1);
    expect(result.vy).toBe(1);
  });
  it("should stop within FOLLOW_STOP_DISTANCE", () => {
    const result = tickFollow(100, 100, 100 + FOLLOW_STOP_DISTANCE, 100);
    expect(result.vx).toBe(0);
    expect(result.vy).toBe(0);
  });
});

describe("pickWanderTarget", () => {
  it("should return a target within WANDER_RADIUS", () => {
    const rng = () => 0.5;
    const target = pickWanderTarget(10, 10, rng);
    expect(Math.abs(target.x - 10)).toBeLessThanOrEqual(WANDER_RADIUS);
    expect(Math.abs(target.y - 10)).toBeLessThanOrEqual(WANDER_RADIUS);
  });
  it("should use rng for randomness", () => {
    const rng = () => 0;
    const target = pickWanderTarget(10, 10, rng);
    expect(target.x).toBe(10 - WANDER_RADIUS);
    expect(target.y).toBe(10 - WANDER_RADIUS);
  });
});

describe("rollSpawnChance", () => {
  it("should return null most of the time at low spawn rate", () => {
    let nullCount = 0;
    for (let i = 0; i < 100; i++) {
      const rng = () => 0.5;
      if (rollSpawnChance(Biome.GRASSLAND, rng, 0.005) === null) nullCount++;
    }
    expect(nullCount).toBe(100);
  });
  it("should return a valid species when spawn succeeds", () => {
    const rng = () => 0;
    const species = rollSpawnChance(Biome.GRASSLAND, rng, 1.0);
    expect(species).not.toBeNull();
    expect(ANIMAL_SPECIES).toContain(species);
  });
  it("should return null for biome with no candidates", () => {
    const rng = () => 0;
    const species = rollSpawnChance(Biome.TUNDRA, rng, 1.0);
    expect(species).toBeNull();
  });
});

describe("AnimalSystem", () => {
  function createAnimalEntity(
    species: "rabbit" | "deer" | "fox" | "bird" | "turtle" = "rabbit",
    x = 160,
    y = 160,
  ): Entity {
    return new Entity("animal_1")
      .addComponent(new PositionComponent(x, y))
      .addComponent(new VelocityComponent())
      .addComponent(new AnimalComponent(species));
  }

  it("should require position, animal, and velocity components", () => {
    const system = new AnimalSystem();
    const full = createAnimalEntity();
    const partial = new Entity("nope").addComponent(new PositionComponent(0, 0));
    expect(system.matches(full)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });
  it("should transition idle animal to wander after interval", () => {
    const rng = () => 0.5;
    const system = new AnimalSystem(rng);
    const entity = createAnimalEntity();
    const animal = entity.getComponent("animal") as AnimalComponent;
    system.setPlayerPosition(1000, 1000);
    system.update([entity], 1);
    expect(animal.behavior).toBe("idle");
    system.update([entity], IDLE_WANDER_INTERVAL_MS / 1000);
    expect(animal.behavior).toBe("wander");
    expect(animal.wanderTarget).not.toBeNull();
  });
  it("should make animal flee when player is close", () => {
    const system = new AnimalSystem();
    const entity = createAnimalEntity("rabbit", 5 * TILE_SIZE, 5 * TILE_SIZE);
    const animal = entity.getComponent("animal") as AnimalComponent;
    const vel = entity.getComponent("velocity") as VelocityComponent;
    system.setPlayerPosition(6 * TILE_SIZE, 5 * TILE_SIZE);
    system.update([entity], 0.1);
    expect(animal.behavior).toBe("flee");
    expect(vel.vx).not.toBe(0);
  });
  it("should make tamed animal follow the player", () => {
    const system = new AnimalSystem();
    const entity = createAnimalEntity("rabbit", 0, 0);
    const animal = entity.getComponent("animal") as AnimalComponent;
    const vel = entity.getComponent("velocity") as VelocityComponent;
    animal.ownerId = "player1";
    animal.behavior = "follow";
    system.setPlayerPosition(200, 200);
    system.update([entity], 0.1);
    expect(vel.vx).toBeGreaterThan(0);
    expect(vel.vy).toBeGreaterThan(0);
    expect(animal.behavior).toBe("follow");
  });
  it("should stop tamed animal when close to owner", () => {
    const system = new AnimalSystem();
    const entity = createAnimalEntity("rabbit", 100, 100);
    const animal = entity.getComponent("animal") as AnimalComponent;
    const vel = entity.getComponent("velocity") as VelocityComponent;
    animal.ownerId = "player1";
    animal.behavior = "follow";
    system.setPlayerPosition(110, 110);
    system.update([entity], 0.1);
    expect(vel.vx).toBe(0);
    expect(vel.vy).toBe(0);
    expect(animal.behavior).toBe("tamed_idle");
  });
  it("should tame animal via feedEntity", () => {
    let tameCalled = 0;
    const system = new AnimalSystem(Math.random, () => tameCalled++);
    const entity = createAnimalEntity("rabbit");
    const animal = entity.getComponent("animal") as AnimalComponent;
    system.feedEntity(entity, "player1");
    expect(animal.feedCount).toBe(1);
    expect(animal.ownerId).toBeNull();
    const tamed = system.feedEntity(entity, "player1");
    expect(tamed).toBe(true);
    expect(animal.feedCount).toBe(2);
    expect(animal.ownerId).toBe("player1");
    expect(animal.behavior).toBe("follow");
    expect(tameCalled).toBe(1);
  });
  it("should not feed already tamed animal", () => {
    const system = new AnimalSystem();
    const entity = createAnimalEntity("rabbit");
    const animal = entity.getComponent("animal") as AnimalComponent;
    animal.ownerId = "player1";
    const result = system.feedEntity(entity, "player2");
    expect(result).toBe(false);
  });
  it("should return fleeing animal to idle after max flee duration", () => {
    const system = new AnimalSystem();
    const entity = createAnimalEntity("rabbit", 5 * TILE_SIZE, 5 * TILE_SIZE);
    const animal = entity.getComponent("animal") as AnimalComponent;
    const vel = entity.getComponent("velocity") as VelocityComponent;

    // Place player within flee distance and flee for 5+ seconds
    system.setPlayerPosition(6 * TILE_SIZE, 5 * TILE_SIZE);
    system.update([entity], 0.1);
    expect(animal.behavior).toBe("flee");

    // Accumulate enough flee time to exceed the 5000ms cap
    system.update([entity], 5.0);
    expect(animal.behavior).toBe("idle");
    expect(animal.fleeTimer).toBe(0);
    expect(vel.vx).toBe(0);
    expect(vel.vy).toBe(0);
  });
  it("should reset fleeTimer when player leaves flee range", () => {
    const system = new AnimalSystem();
    const entity = createAnimalEntity("rabbit", 5 * TILE_SIZE, 5 * TILE_SIZE);
    const animal = entity.getComponent("animal") as AnimalComponent;

    // Start fleeing
    system.setPlayerPosition(6 * TILE_SIZE, 5 * TILE_SIZE);
    system.update([entity], 0.1);
    expect(animal.behavior).toBe("flee");
    expect(animal.fleeTimer).toBeGreaterThan(0);

    // Player moves away
    system.setPlayerPosition(1000, 1000);
    system.update([entity], 0.1);
    expect(animal.behavior).toBe("idle");
    expect(animal.fleeTimer).toBe(0);
  });
});
