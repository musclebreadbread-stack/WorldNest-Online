import { describe, it, expect } from "vitest";
import {
  ITEM_DEFINITIONS,
  ITEM_IDS,
  PLACEABLE_ITEM_IDS,
  isPlaceableStructure,
  type ItemId,
} from "../items";

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

  it("should give every placeable structure a texture key", () => {
    expect(PLACEABLE_ITEM_IDS).toEqual(["fence", "chest"]);

    for (const id of PLACEABLE_ITEM_IDS) {
      expect(isPlaceableStructure(id)).toBe(true);
      expect(ITEM_DEFINITIONS[id].structureTextureKey).toBeTruthy();
    }
    expect(isPlaceableStructure("wood")).toBe(false);
  });
});
