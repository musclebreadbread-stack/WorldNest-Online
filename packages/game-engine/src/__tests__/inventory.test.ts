import { describe, it, expect } from "vitest";
import { INVENTORY_SLOTS, ITEM_DEFINITIONS } from "@worldnest/shared";
import { InventoryComponent } from "../components/InventoryComponent";
import {
  addItem,
  removeItem,
  countItem,
  hasSpaceFor,
  getSelectedItem,
  selectSlot,
  moveSlot,
} from "../inventory/inventoryOps";

const WOOD_STACK = ITEM_DEFINITIONS.wood.stackSize;

describe("InventoryComponent", () => {
  it("should start as an empty grid of the configured size", () => {
    const inventory = new InventoryComponent();

    expect(inventory.type).toBe("inventory");
    expect(inventory.slots).toHaveLength(INVENTORY_SLOTS);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
    expect(inventory.selectedSlot).toBe(0);
  });
});

describe("addItem", () => {
  it("should place items in the first empty slot", () => {
    const inventory = new InventoryComponent();

    expect(addItem(inventory, "wood", 5)).toBe(0);
    expect(inventory.slots[0]).toEqual({ itemId: "wood", quantity: 5 });
    expect(inventory.version).toBe(1);
  });

  it("should fill partial stacks before using empty slots", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 5);
    moveSlot(inventory, 0, 3);

    addItem(inventory, "wood", 4);

    expect(inventory.slots[3]).toEqual({ itemId: "wood", quantity: 9 });
    expect(inventory.slots[0]).toBeNull();
  });

  it("should split across slots at the stack size", () => {
    const inventory = new InventoryComponent();

    expect(addItem(inventory, "wood", WOOD_STACK + 3)).toBe(0);

    expect(inventory.slots[0]).toEqual({ itemId: "wood", quantity: WOOD_STACK });
    expect(inventory.slots[1]).toEqual({ itemId: "wood", quantity: 3 });
  });

  it("should return the overflow when the inventory is full", () => {
    const inventory = new InventoryComponent(2);

    const overflow = addItem(inventory, "wood", WOOD_STACK * 2 + 7);

    expect(overflow).toBe(7);
    expect(countItem(inventory, "wood")).toBe(WOOD_STACK * 2);
  });

  it("should ignore non-positive quantities without bumping the version", () => {
    const inventory = new InventoryComponent();

    expect(addItem(inventory, "wood", 0)).toBe(0);
    expect(inventory.version).toBe(0);
  });
});

describe("removeItem", () => {
  it("should span multiple slots and clear emptied ones", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", WOOD_STACK + 5);

    expect(removeItem(inventory, "wood", WOOD_STACK + 2)).toBe(WOOD_STACK + 2);

    // The full first stack is emptied and cleared, the remainder comes off the second
    expect(inventory.slots[0]).toBeNull();
    expect(inventory.slots[1]).toEqual({ itemId: "wood", quantity: 3 });
  });

  it("should remove only what is available", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "stone", 4);

    expect(removeItem(inventory, "stone", 10)).toBe(4);
    expect(countItem(inventory, "stone")).toBe(0);
  });

  it("should leave other item types alone", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 3);
    addItem(inventory, "stone", 3);

    removeItem(inventory, "wood", 3);

    expect(countItem(inventory, "wood")).toBe(0);
    expect(countItem(inventory, "stone")).toBe(3);
  });
});

describe("hasSpaceFor", () => {
  it("should count both partial stacks and empty slots", () => {
    const inventory = new InventoryComponent(2);
    addItem(inventory, "wood", WOOD_STACK * 2 - 1);

    expect(hasSpaceFor(inventory, "wood", 1)).toBe(true);
    expect(hasSpaceFor(inventory, "wood", 2)).toBe(false);
  });

  it("should not count slots holding a different item", () => {
    const inventory = new InventoryComponent(1);
    addItem(inventory, "stone", 1);

    expect(hasSpaceFor(inventory, "wood", 1)).toBe(false);
  });
});

describe("selectSlot and getSelectedItem", () => {
  it("should clamp the index into range", () => {
    const inventory = new InventoryComponent();

    selectSlot(inventory, 999);
    expect(inventory.selectedSlot).toBe(INVENTORY_SLOTS - 1);

    selectSlot(inventory, -4);
    expect(inventory.selectedSlot).toBe(0);
  });

  it("should return the contents of the selected slot", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wheat_seed", 5);
    addItem(inventory, "fence", 1);

    expect(getSelectedItem(inventory)).toEqual({ itemId: "wheat_seed", quantity: 5 });

    selectSlot(inventory, 1);
    expect(getSelectedItem(inventory)).toEqual({ itemId: "fence", quantity: 1 });

    selectSlot(inventory, 2);
    expect(getSelectedItem(inventory)).toBeNull();
  });
});

describe("moveSlot", () => {
  it("should swap two different items", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 2);
    addItem(inventory, "stone", 3);

    moveSlot(inventory, 0, 1);

    expect(inventory.slots[0]).toEqual({ itemId: "stone", quantity: 3 });
    expect(inventory.slots[1]).toEqual({ itemId: "wood", quantity: 2 });
  });

  it("should merge stacks of the same item and leave the remainder behind", () => {
    const inventory = new InventoryComponent();
    inventory.slots[0] = { itemId: "wood", quantity: 10 };
    inventory.slots[1] = { itemId: "wood", quantity: WOOD_STACK - 4 };

    moveSlot(inventory, 0, 1);

    expect(inventory.slots[1]).toEqual({ itemId: "wood", quantity: WOOD_STACK });
    expect(inventory.slots[0]).toEqual({ itemId: "wood", quantity: 6 });
  });

  it("should ignore moves from empty slots or out of range indices", () => {
    const inventory = new InventoryComponent();
    addItem(inventory, "wood", 1);

    moveSlot(inventory, 5, 6);
    moveSlot(inventory, 0, INVENTORY_SLOTS);
    moveSlot(inventory, 0, 0);

    expect(inventory.slots[0]).toEqual({ itemId: "wood", quantity: 1 });
    expect(inventory.version).toBe(1);
  });
});
