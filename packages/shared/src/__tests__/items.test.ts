import { describe, it, expect } from "vitest";
import { ITEM_DEFINITIONS, ITEM_IDS, type ItemId } from "../items";

const EXPECTED_IDS: ItemId[] = [
  "wood",
  "stone",
  "fiber",
  "flower",
  "wheat_seed",
  "wheat",
  "fence",
  "chest",
];

describe("ITEM_DEFINITIONS", () => {
  it("should define every known item id", () => {
    expect(ITEM_IDS.sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it("should give every item a stackable, named definition", () => {
    for (const id of ITEM_IDS) {
      const definition = ITEM_DEFINITIONS[id];
      expect(definition.id).toBe(id);
      expect(definition.displayName.length).toBeGreaterThan(0);
      expect(definition.stackSize).toBeGreaterThanOrEqual(1);
    }
  });

  it("should mark fence and chest as placeable structures", () => {
    expect(ITEM_DEFINITIONS.fence.placeableStructure).toBe(true);
    expect(ITEM_DEFINITIONS.chest.placeableStructure).toBe(true);
    expect(ITEM_DEFINITIONS.wood.placeableStructure).toBeUndefined();
  });
});
