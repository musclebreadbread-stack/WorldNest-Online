import { describe, it, expect } from "vitest";
import {
  ITEM_DEFINITIONS,
  ITEM_IDS,
  PLACEABLE_ITEM_IDS,
  isItemId,
  isPlaceableStructure,
  type ItemId,
} from "../items";

const EXPECTED_IDS: ItemId[] = [
  "wood",
  "stone",
  "ore",
  "fiber",
  "flower",
  "wheat_seed",
  "wheat",
  "carrot_seed",
  "carrot",
  "melon_seed",
  "melon",
  "fence",
  "chest",
  "path_stone",
  "fishing_rod",
  "fish_common",
  "fish_rare",
  "fish_tropical",
  "bread",
  "fish_pie",
  "carrot_soup",
  "fruit_salad",
  "animal_feed",
  "pet_treat",
  "house_deed",
  "table",
  "chair",
  "bed",
  "lamp",
  "bookshelf",
  "rug",
  "painting",
  "plant_pot",
  "window_curtain",
  "iron_ingot",
  "plank",
  "cloth",
  "stone_axe",
  "iron_axe",
  "stone_pickaxe",
  "iron_pickaxe",
  "workbench",
  "rhythm_drum",
  "rhythm_flute",
  "rhythm_harp",
  "rhythm_xylophone",
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

  it("should carry the ore mined from cave tiles", () => {
    // Mining ore is the only source of this item, so the cave tiles in the
    // generator and the catalogue have to agree on its id
    expect(ITEM_DEFINITIONS.ore).toEqual({
      id: "ore",
      displayName: "Ore",
      stackSize: 99,
    });
    expect(isItemId("ore")).toBe(true);
  });

  it("should recognise catalogue ids and reject anything else", () => {
    for (const id of ITEM_IDS) {
      expect(isItemId(id)).toBe(true);
    }
    expect(isItemId("unobtainium")).toBe(false);
    expect(isItemId(undefined)).toBe(false);
    expect(isItemId(7)).toBe(false);
  });

  it("should mark fence and chest as placeable structures", () => {
    expect(ITEM_DEFINITIONS.fence.placeableStructure).toBe(true);
    expect(ITEM_DEFINITIONS.chest.placeableStructure).toBe(true);
    expect(ITEM_DEFINITIONS.wood.placeableStructure).toBeUndefined();
  });

  it("should give every placeable structure a texture key", () => {
    expect(PLACEABLE_ITEM_IDS).toEqual(["fence", "chest", "workbench"]);

    for (const id of PLACEABLE_ITEM_IDS) {
      expect(isPlaceableStructure(id)).toBe(true);
      expect(ITEM_DEFINITIONS[id].structureTextureKey).toBeTruthy();
    }
    expect(isPlaceableStructure("wood")).toBe(false);
  });
});
