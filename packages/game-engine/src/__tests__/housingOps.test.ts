import { describe, it, expect } from "vitest";
import { InventoryComponent } from "../components/InventoryComponent";
import { addItem } from "../inventory/inventoryOps";
import {
  canEnterHouse,
  canPlaceFurniture,
  canUnlockRoom,
  createDefaultHousingState,
  createRoom,
  getAvailableFurniture,
  getOverallHappiness,
  getRoomHappiness,
  placeFurniture,
  removeFurniture,
  ROOM_DEFINITIONS,
  FURNITURE_DEFINITIONS,
} from "../housing";
import type { ItemId } from "@worldnest/shared";

describe("housingDefinitions", () => {
  it("should define 4 room types", () => {
    const rooms = Object.keys(ROOM_DEFINITIONS);
    expect(rooms).toHaveLength(4);
    expect(rooms).toContain("living_room");
    expect(rooms).toContain("bedroom");
    expect(rooms).toContain("kitchen");
    expect(rooms).toContain("study");
  });

  it("should define furniture for all 9 furniture items", () => {
    const ids: ItemId[] = [
      "table",
      "chair",
      "bed",
      "lamp",
      "bookshelf",
      "rug",
      "painting",
      "plant_pot",
      "window_curtain",
    ];
    for (const id of ids) {
      expect(FURNITURE_DEFINITIONS[id]).toBeDefined();
    }
  });

  it("should have positive dimensions for all rooms", () => {
    for (const def of Object.values(ROOM_DEFINITIONS)) {
      expect(def.width).toBeGreaterThan(0);
      expect(def.height).toBeGreaterThan(0);
      expect(def.maxFurniture).toBeGreaterThan(0);
    }
  });
});

describe("createRoom", () => {
  it("should create a room with given type and empty furniture", () => {
    const room = createRoom("bedroom");
    expect(room.type).toBe("bedroom");
    expect(room.furniture).toEqual([]);
    expect(room.unlocked).toBe(false);
  });

  it("should have living_room unlocked by default", () => {
    const room = createRoom("living_room");
    expect(room.unlocked).toBe(true);
  });
});

describe("createDefaultHousingState", () => {
  it("should create state with 4 rooms", () => {
    const state = createDefaultHousingState();
    expect(state.rooms).toHaveLength(4);
    expect(state.activeRoom).toBeNull();
    expect(state.happiness).toBe(0);
  });

  it("should have only living room unlocked", () => {
    const state = createDefaultHousingState();
    const unlocked = state.rooms.filter((r) => r.unlocked);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].type).toBe("living_room");
  });
});

describe("canEnterHouse", () => {
  it("should return true when inventory has house_deed", () => {
    const inv = new InventoryComponent();
    addItem(inv, "house_deed" as ItemId, 1);
    expect(canEnterHouse(inv)).toBe(true);
  });

  it("should return false without house_deed", () => {
    const inv = new InventoryComponent();
    expect(canEnterHouse(inv)).toBe(false);
  });
});

describe("canPlaceFurniture", () => {
  it("should return true for valid placement", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    expect(canPlaceFurniture(room, "table" as ItemId, 0, 0)).toBe(true);
  });

  it("should return false for out of bounds x", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    const w = ROOM_DEFINITIONS.living_room.width;
    expect(canPlaceFurniture(room, "table" as ItemId, w, 0)).toBe(false);
  });

  it("should return false for out of bounds y", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    const h = ROOM_DEFINITIONS.living_room.height;
    expect(canPlaceFurniture(room, "table" as ItemId, 0, h)).toBe(false);
  });

  it("should return false for negative coordinates", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    expect(canPlaceFurniture(room, "table" as ItemId, -1, 0)).toBe(false);
  });

  it("should return false when furniture overlaps", () => {
    let room = createRoom("living_room");
    room.unlocked = true;
    room = placeFurniture(room, "table" as ItemId, 2, 2)!;
    expect(canPlaceFurniture(room, "chair" as ItemId, 2, 2)).toBe(false);
  });

  it("should return false when max furniture reached", () => {
    const room = createRoom("study");
    room.unlocked = true;
    const max = ROOM_DEFINITIONS.study.maxFurniture;
    for (let i = 0; i < max; i++) {
      room.furniture.push({ itemId: "lamp" as ItemId, x: i, y: 0 });
    }
    expect(canPlaceFurniture(room, "table" as ItemId, 0, 1)).toBe(false);
  });

  it("should return false for non-furniture item", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    expect(canPlaceFurniture(room, "wood" as ItemId, 0, 0)).toBe(false);
  });
});

describe("placeFurniture", () => {
  it("should return updated room on valid placement", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    const result = placeFurniture(room, "chair" as ItemId, 1, 1);
    expect(result).not.toBeNull();
    expect(result!.furniture).toHaveLength(1);
    expect(result!.furniture[0]).toEqual({ itemId: "chair", x: 1, y: 1 });
  });

  it("should return null on invalid placement", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    const result = placeFurniture(room, "table" as ItemId, -1, -1);
    expect(result).toBeNull();
  });
});

describe("removeFurniture", () => {
  it("should remove furniture at valid index", () => {
    let room = createRoom("living_room");
    room.unlocked = true;
    room = placeFurniture(room, "lamp" as ItemId, 0, 0)!;
    const result = removeFurniture(room, 0);
    expect(result).not.toBeNull();
    expect(result!.room.furniture).toHaveLength(0);
    expect(result!.removedItem).toBe("lamp");
  });

  it("should return null for negative index", () => {
    const room = createRoom("living_room");
    expect(removeFurniture(room, -1)).toBeNull();
  });

  it("should return null for out of bounds index", () => {
    const room = createRoom("living_room");
    expect(removeFurniture(room, 5)).toBeNull();
  });
});

describe("getRoomHappiness", () => {
  it("should return 0 for empty room", () => {
    const room = createRoom("living_room");
    expect(getRoomHappiness(room)).toBe(0);
  });

  it("should increase with more furniture", () => {
    let room = createRoom("living_room");
    room.unlocked = true;
    room = placeFurniture(room, "table" as ItemId, 0, 0)!;
    const score1 = getRoomHappiness(room);
    room = placeFurniture(room, "lamp" as ItemId, 1, 0)!;
    const score2 = getRoomHappiness(room);
    expect(score2).toBeGreaterThan(score1);
  });

  it("should increase with more variety", () => {
    let room = createRoom("living_room");
    room.unlocked = true;
    room = placeFurniture(room, "table" as ItemId, 0, 0)!;
    room = placeFurniture(room, "chair" as ItemId, 1, 0)!;
    const sameCategory = getRoomHappiness(room);

    let room2 = createRoom("living_room");
    room2.unlocked = true;
    room2 = placeFurniture(room2, "table" as ItemId, 0, 0)!;
    room2 = placeFurniture(room2, "lamp" as ItemId, 1, 0)!;
    const diffCategory = getRoomHappiness(room2);
    expect(diffCategory).toBeGreaterThan(sameCategory);
  });

  it("should cap at 100", () => {
    const room = createRoom("living_room");
    room.unlocked = true;
    room.furniture = [
      { itemId: "table" as ItemId, x: 0, y: 0 },
      { itemId: "bed" as ItemId, x: 1, y: 0 },
      { itemId: "lamp" as ItemId, x: 2, y: 0 },
      { itemId: "bookshelf" as ItemId, x: 3, y: 0 },
      { itemId: "rug" as ItemId, x: 4, y: 0 },
      { itemId: "painting" as ItemId, x: 5, y: 0 },
      { itemId: "plant_pot" as ItemId, x: 0, y: 1 },
      { itemId: "window_curtain" as ItemId, x: 1, y: 1 },
    ];
    const score = getRoomHappiness(room);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(0);
  });
});

describe("getOverallHappiness", () => {
  it("should return 0 when no unlocked rooms", () => {
    const state = createDefaultHousingState();
    state.rooms.forEach((r) => (r.unlocked = false));
    expect(getOverallHappiness(state)).toBe(0);
  });

  it("should average happiness across unlocked rooms", () => {
    const state = createDefaultHousingState();
    state.rooms[0].furniture = [
      { itemId: "table" as ItemId, x: 0, y: 0 },
      { itemId: "lamp" as ItemId, x: 1, y: 0 },
    ];
    const score = getOverallHappiness(state);
    expect(score).toBeGreaterThan(0);
  });
});

describe("canUnlockRoom", () => {
  it("should return true when enough coins", () => {
    expect(canUnlockRoom(150, "study")).toBe(true);
  });

  it("should return false with insufficient coins", () => {
    expect(canUnlockRoom(50, "study")).toBe(false);
  });

  it("should return true for free rooms", () => {
    expect(canUnlockRoom(0, "living_room")).toBe(true);
  });
});

describe("getAvailableFurniture", () => {
  it("should return furniture items from inventory", () => {
    const inv = new InventoryComponent();
    addItem(inv, "table" as ItemId, 2);
    addItem(inv, "wood" as ItemId, 5);
    const available = getAvailableFurniture(inv);
    expect(available).toContain("table");
    expect(available).not.toContain("wood");
  });

  it("should return empty array when no furniture in inventory", () => {
    const inv = new InventoryComponent();
    addItem(inv, "stone" as ItemId, 10);
    expect(getAvailableFurniture(inv)).toEqual([]);
  });
});
