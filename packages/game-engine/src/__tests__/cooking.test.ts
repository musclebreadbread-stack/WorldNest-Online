import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { CookingComponent } from "../components/CookingComponent";
import { CookingSystem } from "../systems/CookingSystem";
import { addItem, countItem } from "../inventory/inventoryOps";
import {
  canCook,
  completeCooking,
  consumeFood,
  FOOD_ENERGY,
  getRecipe,
  RECIPE_IDS,
  startCooking,
  tickCooking,
} from "../cooking";

interface Harness {
  entity: Entity;
  inventory: InventoryComponent;
  stats: StatsComponent;
  cooking: CookingComponent;
  system: CookingSystem;
}

function createHarness(): Harness {
  const inventory = new InventoryComponent();
  const stats = new StatsComponent();
  const cooking = new CookingComponent();
  const entity = new Entity("player")
    .addComponent(inventory)
    .addComponent(stats)
    .addComponent(cooking);
  const system = new CookingSystem();

  return { entity, inventory, stats, cooking, system };
}

describe("cookingDefinitions", () => {
  it("should define exactly 4 recipes", () => {
    expect(RECIPE_IDS).toHaveLength(4);
    expect(RECIPE_IDS).toContain("bread");
    expect(RECIPE_IDS).toContain("fish_pie");
    expect(RECIPE_IDS).toContain("carrot_soup");
    expect(RECIPE_IDS).toContain("fruit_salad");
  });

  it("should return a recipe for a valid id", () => {
    const recipe = getRecipe("bread");
    expect(recipe).toBeDefined();
    expect(recipe!.resultItemId).toBe("bread");
    expect(recipe!.resultQuantity).toBe(1);
    expect(recipe!.cookTimeMs).toBe(2000);
  });

  it("should return undefined for an unknown recipe", () => {
    expect(getRecipe("nonexistent")).toBeUndefined();
  });

  it("should have correct ingredients for each recipe", () => {
    const bread = getRecipe("bread")!;
    expect(bread.ingredients).toEqual([{ itemId: "wheat", quantity: 1 }]);

    const fishPie = getRecipe("fish_pie")!;
    expect(fishPie.ingredients).toEqual([
      { itemId: "fish_common", quantity: 1 },
      { itemId: "wheat", quantity: 1 },
    ]);

    const carrotSoup = getRecipe("carrot_soup")!;
    expect(carrotSoup.ingredients).toEqual([
      { itemId: "carrot", quantity: 2 },
      { itemId: "wheat", quantity: 1 },
    ]);

    const fruitSalad = getRecipe("fruit_salad")!;
    expect(fruitSalad.ingredients).toEqual([{ itemId: "melon", quantity: 2 }]);
  });

  it("should have energy values for all cooked foods", () => {
    expect(FOOD_ENERGY.bread).toBe(15);
    expect(FOOD_ENERGY.fish_pie).toBe(30);
    expect(FOOD_ENERGY.carrot_soup).toBe(25);
    expect(FOOD_ENERGY.fruit_salad).toBe(20);
  });
});

describe("canCook", () => {
  it("should return true when all ingredients are present", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wheat", 1);
    expect(canCook(inventory, "bread")).toBe(true);
  });

  it("should return false when ingredients are missing", () => {
    const inventory = new InventoryComponent();
    expect(canCook(inventory, "bread")).toBe(false);
  });

  it("should return false for an unknown recipe", () => {
    const inventory = new InventoryComponent();
    expect(canCook(inventory, "nonexistent")).toBe(false);
  });

  it("should return false when not enough of an ingredient", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "carrot", 1); // needs 2
    addItem(inventory, "wheat", 1);
    expect(canCook(inventory, "carrot_soup")).toBe(false);
  });

  it("should return true with exact ingredient amounts", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "fish_common", 1);
    addItem(inventory, "wheat", 1);
    expect(canCook(inventory, "fish_pie")).toBe(true);
  });
});

describe("startCooking", () => {
  it("should transition to cooking state with valid recipe", () => {
    const state = { state: "idle" as const, selectedRecipe: null, timer: 0 };
    expect(startCooking(state, "bread")).toBe(true);
    expect(state.state).toBe("cooking");
    expect(state.selectedRecipe).toBe("bread");
    expect(state.timer).toBe(0);
  });

  it("should return false for unknown recipe", () => {
    const state = { state: "idle" as const, selectedRecipe: null, timer: 0 };
    expect(startCooking(state, "unknown")).toBe(false);
    expect(state.state).toBe("idle");
  });

  it("should return false when not idle", () => {
    const state = { state: "cooking" as const, selectedRecipe: "bread", timer: 500 };
    expect(startCooking(state, "bread")).toBe(false);
  });
});

describe("tickCooking", () => {
  it("should advance timer while cooking", () => {
    const result = tickCooking("cooking", 0, 500, 2000);
    expect(result.state).toBe("cooking");
    expect(result.timer).toBe(500);
  });

  it("should transition to done when timer exceeds cook time", () => {
    const result = tickCooking("cooking", 1800, 300, 2000);
    expect(result.state).toBe("done");
    expect(result.timer).toBe(2100);
  });

  it("should not change non-cooking states", () => {
    const result = tickCooking("idle", 0, 500, 2000);
    expect(result.state).toBe("idle");
  });
});

describe("completeCooking", () => {
  it("should remove ingredients and add result", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wheat", 3);
    expect(completeCooking("bread", inventory)).toBe(true);
    expect(countItem(inventory, "wheat")).toBe(2);
    expect(countItem(inventory, "bread")).toBe(1);
  });

  it("should return false when ingredients are missing", () => {
    const inventory = new InventoryComponent();
    expect(completeCooking("bread", inventory)).toBe(false);
  });

  it("should return false for null recipe", () => {
    const inventory = new InventoryComponent();
    expect(completeCooking(null, inventory)).toBe(false);
  });
});

describe("consumeFood", () => {
  it("should restore energy and remove item", () => {
    const stats = new StatsComponent();
    stats.energy = 50;
    const inventory = new InventoryComponent();
    addItem(inventory, "bread", 2);

    expect(consumeFood(stats, inventory, "bread")).toBe(true);
    expect(stats.energy).toBe(65);
    expect(countItem(inventory, "bread")).toBe(1);
  });

  it("should cap energy at maxEnergy", () => {
    const stats = new StatsComponent();
    stats.energy = stats.maxEnergy - 5;
    const inventory = new InventoryComponent();
    addItem(inventory, "fish_pie", 1); // restores 30

    expect(consumeFood(stats, inventory, "fish_pie")).toBe(true);
    expect(stats.energy).toBe(stats.maxEnergy);
  });

  it("should return false when item is not food", () => {
    const stats = new StatsComponent();
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 5);

    expect(consumeFood(stats, inventory, "wood")).toBe(false);
  });

  it("should return false when item is not in inventory", () => {
    const stats = new StatsComponent();
    const inventory = new InventoryComponent();

    expect(consumeFood(stats, inventory, "bread")).toBe(false);
  });
});

describe("CookingSystem", () => {
  it("should require cooking, inventory, and stats components", () => {
    const { system, entity } = createHarness();
    const partial = new Entity("prop").addComponent(new InventoryComponent());

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });

  it("should start cooking on requestedCook with valid ingredients", () => {
    const { entity, inventory, cooking, system } = createHarness();
    addItem(inventory, "wheat", 1);
    cooking.requestedCook = "bread";

    system.update([entity], 1 / 60);

    expect(cooking.state).toBe("cooking");
    expect(cooking.selectedRecipe).toBe("bread");
    expect(cooking.requestedCook).toBeNull();
  });

  it("should fail on requestedCook without ingredients", () => {
    const { entity, cooking, system } = createHarness();
    cooking.requestedCook = "bread";

    system.update([entity], 1 / 60);

    // failed -> idle in same frame
    expect(cooking.state).toBe("idle");
    expect(cooking.requestedCook).toBeNull();
  });

  it("should complete cooking after elapsed time", () => {
    const { entity, inventory, cooking, system } = createHarness();
    addItem(inventory, "wheat", 1);
    cooking.requestedCook = "bread";

    system.update([entity], 1 / 60); // starts cooking
    expect(cooking.state).toBe("cooking");

    // Advance past cook time (2000ms = 2s)
    system.update([entity], 3); // 3000ms > 2000ms

    // done -> idle in same frame
    expect(cooking.state).toBe("idle");
    expect(countItem(inventory, "bread")).toBe(1);
    expect(countItem(inventory, "wheat")).toBe(0);
  });

  it("should handle consume requests independently", () => {
    const { entity, inventory, stats, cooking, system } = createHarness();
    addItem(inventory, "carrot_soup", 1);
    stats.energy = 40;
    cooking.requestedConsume = "carrot_soup";

    system.update([entity], 1 / 60);

    expect(stats.energy).toBe(65); // 40 + 25
    expect(countItem(inventory, "carrot_soup")).toBe(0);
    expect(cooking.requestedConsume).toBeNull();
  });

  it("should not advance timer when not in cooking state", () => {
    const { entity, cooking, system } = createHarness();
    cooking.state = "idle";
    cooking.timer = 0;

    system.update([entity], 1);

    expect(cooking.timer).toBe(0);
  });

  it("should bump version on state changes", () => {
    const { entity, inventory, cooking, system } = createHarness();
    addItem(inventory, "wheat", 1);
    const initialVersion = cooking.version;
    cooking.requestedCook = "bread";

    system.update([entity], 1 / 60);
    expect(cooking.version).toBeGreaterThan(initialVersion);
  });
});
