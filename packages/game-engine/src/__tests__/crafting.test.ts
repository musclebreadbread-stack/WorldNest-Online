import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { CraftingComponent } from "../components/CraftingComponent";
import { CraftingSystem } from "../systems/CraftingSystem";
import { addItem, countItem } from "../inventory/inventoryOps";
import {
  CRAFTING_RECIPE_IDS,
  getCraftingRecipe,
  canCraft,
  startCraft,
  tickCraft,
  completeCraft,
  getToolBonus,
  getAvailableRecipes,
} from "../crafting";

interface Harness {
  entity: Entity;
  inventory: InventoryComponent;
  crafting: CraftingComponent;
  system: CraftingSystem;
}

function createHarness(): Harness {
  const inventory = new InventoryComponent();
  const crafting = new CraftingComponent();
  const entity = new Entity("player").addComponent(inventory).addComponent(crafting);
  const system = new CraftingSystem();
  return { entity, inventory, crafting, system };
}

describe("craftingDefinitions", () => {
  it("should define exactly 8 recipes", () => {
    expect(CRAFTING_RECIPE_IDS).toHaveLength(8);
  });

  it("should include all expected recipe ids", () => {
    const ids = CRAFTING_RECIPE_IDS;
    expect(ids).toContain("iron_ingot");
    expect(ids).toContain("plank");
    expect(ids).toContain("cloth");
    expect(ids).toContain("workbench");
    expect(ids).toContain("stone_axe");
    expect(ids).toContain("iron_axe");
    expect(ids).toContain("stone_pickaxe");
    expect(ids).toContain("iron_pickaxe");
  });

  it("should return a recipe for iron_ingot", () => {
    const recipe = getCraftingRecipe("iron_ingot");
    expect(recipe).toBeDefined();
    expect(recipe!.resultItemId).toBe("iron_ingot");
    expect(recipe!.station).toBe("workbench");
    expect(recipe!.craftTimeMs).toBe(3000);
  });

  it("should return a recipe for plank", () => {
    const recipe = getCraftingRecipe("plank");
    expect(recipe).toBeDefined();
    expect(recipe!.resultItemId).toBe("plank");
    expect(recipe!.station).toBe("hand");
    expect(recipe!.craftTimeMs).toBe(1000);
  });

  it("should return undefined for unknown recipe", () => {
    expect(getCraftingRecipe("nonexistent")).toBeUndefined();
  });

  it("should have correct ingredients for workbench recipe", () => {
    const recipe = getCraftingRecipe("workbench")!;
    expect(recipe.ingredients).toEqual([
      { itemId: "plank", quantity: 4 },
      { itemId: "iron_ingot", quantity: 2 },
    ]);
  });

  it("should have correct ingredients for stone_axe", () => {
    const recipe = getCraftingRecipe("stone_axe")!;
    expect(recipe.ingredients).toEqual([
      { itemId: "stone", quantity: 3 },
      { itemId: "wood", quantity: 2 },
    ]);
  });

  it("should require workbench station for iron tools", () => {
    expect(getCraftingRecipe("iron_axe")!.station).toBe("workbench");
    expect(getCraftingRecipe("iron_pickaxe")!.station).toBe("workbench");
  });

  it("should allow hand station for stone tools", () => {
    expect(getCraftingRecipe("stone_axe")!.station).toBe("hand");
    expect(getCraftingRecipe("stone_pickaxe")!.station).toBe("hand");
  });
});

describe("canCraft", () => {
  it("should return true when ingredients and station match", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 5);
    expect(canCraft(inventory, "plank", "hand")).toBe(true);
  });

  it("should return false when ingredients are missing", () => {
    const inventory = new InventoryComponent();
    expect(canCraft(inventory, "plank", "hand")).toBe(false);
  });

  it("should return false for unknown recipe", () => {
    const inventory = new InventoryComponent();
    expect(canCraft(inventory, "nonexistent", "hand")).toBe(false);
  });

  it("should return false when station does not match", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "ore", 5);
    expect(canCraft(inventory, "iron_ingot", "hand")).toBe(false);
  });

  it("should return true for workbench recipe at workbench", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "ore", 5);
    expect(canCraft(inventory, "iron_ingot", "workbench")).toBe(true);
  });

  it("should return false when not enough ingredients", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "ore", 1); // needs 2
    expect(canCraft(inventory, "iron_ingot", "workbench")).toBe(false);
  });

  it("should check all ingredients for multi-input recipes", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "plank", 4);
    // Missing iron_ingot
    expect(canCraft(inventory, "workbench", "hand")).toBe(false);
  });
});

describe("startCraft", () => {
  it("should transition to crafting state with valid recipe", () => {
    const state = { state: "idle" as const, selectedRecipe: null, timer: 0 };
    expect(startCraft(state, "plank")).toBe(true);
    expect(state.state).toBe("crafting");
    expect(state.selectedRecipe).toBe("plank");
    expect(state.timer).toBe(0);
  });

  it("should return false for unknown recipe", () => {
    const state = { state: "idle" as const, selectedRecipe: null, timer: 0 };
    expect(startCraft(state, "unknown")).toBe(false);
    expect(state.state).toBe("idle");
  });

  it("should return false when not idle", () => {
    const state = {
      state: "crafting" as const,
      selectedRecipe: "plank",
      timer: 500,
    };
    expect(startCraft(state, "plank")).toBe(false);
  });
});

describe("tickCraft", () => {
  it("should advance timer while crafting", () => {
    const result = tickCraft("crafting", 0, 500, 1000);
    expect(result.state).toBe("crafting");
    expect(result.timer).toBe(500);
  });

  it("should transition to done when timer exceeds craft time", () => {
    const result = tickCraft("crafting", 800, 300, 1000);
    expect(result.state).toBe("done");
    expect(result.timer).toBe(1100);
  });

  it("should not change non-crafting states", () => {
    const result = tickCraft("idle", 0, 500, 1000);
    expect(result.state).toBe("idle");
    expect(result.timer).toBe(0);
  });

  it("should handle exact completion time", () => {
    const result = tickCraft("crafting", 500, 500, 1000);
    expect(result.state).toBe("done");
  });
});

describe("completeCraft", () => {
  it("should remove ingredients and add result", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 5);
    expect(completeCraft("plank", inventory)).toBe(true);
    expect(countItem(inventory, "wood")).toBe(3);
    expect(countItem(inventory, "plank")).toBe(1);
  });

  it("should return false when ingredients are missing", () => {
    const inventory = new InventoryComponent();
    expect(completeCraft("plank", inventory)).toBe(false);
  });

  it("should return false for null recipe", () => {
    const inventory = new InventoryComponent();
    expect(completeCraft(null, inventory)).toBe(false);
  });

  it("should handle multi-ingredient recipe", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "stone", 5);
    addItem(inventory, "wood", 5);
    expect(completeCraft("stone_axe", inventory)).toBe(true);
    expect(countItem(inventory, "stone")).toBe(2);
    expect(countItem(inventory, "wood")).toBe(3);
    expect(countItem(inventory, "stone_axe")).toBe(1);
  });
});

describe("getToolBonus", () => {
  it("should return 1.0 with no tools", () => {
    const inventory = new InventoryComponent();
    expect(getToolBonus(inventory, "axe")).toBe(1.0);
    expect(getToolBonus(inventory, "pickaxe")).toBe(1.0);
  });

  it("should return 1.5 for stone axe", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "stone_axe", 1);
    expect(getToolBonus(inventory, "axe")).toBe(1.5);
  });

  it("should return 2.0 for iron axe", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "iron_axe", 1);
    expect(getToolBonus(inventory, "axe")).toBe(2.0);
  });

  it("should prefer iron over stone when both are held", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "stone_axe", 1);
    addItem(inventory, "iron_axe", 1);
    expect(getToolBonus(inventory, "axe")).toBe(2.0);
  });

  it("should return 1.5 for stone pickaxe", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "stone_pickaxe", 1);
    expect(getToolBonus(inventory, "pickaxe")).toBe(1.5);
  });

  it("should return 2.0 for iron pickaxe", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "iron_pickaxe", 1);
    expect(getToolBonus(inventory, "pickaxe")).toBe(2.0);
  });
});

describe("getAvailableRecipes", () => {
  it("should return only hand recipes for hand station", () => {
    const recipes = getAvailableRecipes("hand");
    for (const id of recipes) {
      expect(getCraftingRecipe(id)!.station).toBe("hand");
    }
  });

  it("should return all recipes for workbench station", () => {
    const recipes = getAvailableRecipes("workbench");
    expect(recipes.length).toBe(CRAFTING_RECIPE_IDS.length);
  });

  it("should include plank in hand recipes", () => {
    const recipes = getAvailableRecipes("hand");
    expect(recipes).toContain("plank");
    expect(recipes).toContain("cloth");
    expect(recipes).toContain("stone_axe");
  });

  it("should not include iron_ingot in hand recipes", () => {
    const recipes = getAvailableRecipes("hand");
    expect(recipes).not.toContain("iron_ingot");
    expect(recipes).not.toContain("iron_axe");
  });
});

describe("CraftingSystem", () => {
  it("should require crafting and inventory components", () => {
    const { system, entity } = createHarness();
    const partial = new Entity("prop").addComponent(new InventoryComponent());

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });

  it("should start crafting on requestedCraft with ingredients", () => {
    const { entity, inventory, crafting, system } = createHarness();
    addItem(inventory, "wood", 5);
    crafting.requestedCraft = "plank";

    system.update([entity], 1 / 60);

    expect(crafting.state).toBe("crafting");
    expect(crafting.selectedRecipe).toBe("plank");
    expect(crafting.requestedCraft).toBeNull();
  });

  it("should fail on requestedCraft without ingredients", () => {
    const { entity, crafting, system } = createHarness();
    crafting.requestedCraft = "plank";

    system.update([entity], 1 / 60);

    expect(crafting.state).toBe("failed");
    expect(crafting.requestedCraft).toBeNull();

    system.update([entity], 1 / 60);
    expect(crafting.state).toBe("idle");
  });

  it("should fail when station does not match", () => {
    const { entity, inventory, crafting, system } = createHarness();
    addItem(inventory, "ore", 5);
    crafting.station = "hand";
    crafting.requestedCraft = "iron_ingot";

    system.update([entity], 1 / 60);
    expect(crafting.state).toBe("failed");
  });

  it("should succeed with correct station", () => {
    const { entity, inventory, crafting, system } = createHarness();
    addItem(inventory, "ore", 5);
    crafting.station = "workbench";
    crafting.requestedCraft = "iron_ingot";

    system.update([entity], 1 / 60);
    expect(crafting.state).toBe("crafting");
  });

  it("should complete crafting after elapsed time", () => {
    const { entity, inventory, crafting, system } = createHarness();
    addItem(inventory, "wood", 5);
    crafting.requestedCraft = "plank";

    system.update([entity], 1 / 60); // starts
    expect(crafting.state).toBe("crafting");

    system.update([entity], 2); // 2000ms > 1000ms
    expect(crafting.state).toBe("done");
    expect(countItem(inventory, "plank")).toBe(1);
    expect(countItem(inventory, "wood")).toBe(3);

    system.update([entity], 1 / 60); // resets
    expect(crafting.state).toBe("idle");
  });

  it("should bump version on state changes", () => {
    const { entity, inventory, crafting, system } = createHarness();
    addItem(inventory, "wood", 5);
    const initial = crafting.version;
    crafting.requestedCraft = "plank";

    system.update([entity], 1 / 60);
    expect(crafting.version).toBeGreaterThan(initial);
  });

  it("should not advance timer when idle", () => {
    const { entity, crafting, system } = createHarness();
    crafting.state = "idle";
    crafting.timer = 0;

    system.update([entity], 1);
    expect(crafting.timer).toBe(0);
  });

  it("should call onCraftComplete listener on success", () => {
    let called = false;
    const inventory = new InventoryComponent();
    const crafting = new CraftingComponent();
    const entity = new Entity("player").addComponent(inventory).addComponent(crafting);
    const system = new CraftingSystem(() => {
      called = true;
    });

    addItem(inventory, "fiber", 5);
    crafting.requestedCraft = "cloth";

    system.update([entity], 1 / 60);
    system.update([entity], 2); // completes

    expect(called).toBe(true);
  });
});
