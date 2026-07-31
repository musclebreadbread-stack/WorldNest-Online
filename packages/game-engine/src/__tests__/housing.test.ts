import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { HousingComponent } from "../components/HousingComponent";
import { HousingSystem } from "../systems/HousingSystem";
import { addItem, countItem } from "../inventory/inventoryOps";
import type { ItemId } from "@worldnest/shared";

interface Harness {
  entity: Entity;
  inventory: InventoryComponent;
  wallet: WalletComponent;
  housing: HousingComponent;
  system: HousingSystem;
}

function createHarness(): Harness {
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(500);
  const housing = new HousingComponent();
  const entity = new Entity("player")
    .addComponent(inventory)
    .addComponent(wallet)
    .addComponent(housing);
  const system = new HousingSystem();
  return { entity, inventory, wallet, housing, system };
}

describe("HousingSystem", () => {
  it("should require housing, inventory, and wallet components", () => {
    const { system, entity } = createHarness();
    const partial = new Entity("npc").addComponent(new InventoryComponent());
    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });

  it("should enter house when deed is owned", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "house_deed" as ItemId, 1);
    housing.enterRequested = true;

    system.update([entity], 1 / 60);

    expect(housing.state.activeRoom).toBe("living_room");
    expect(housing.enterRequested).toBe(false);
  });

  it("should not enter house without deed", () => {
    const { entity, housing, system } = createHarness();
    housing.enterRequested = true;

    system.update([entity], 1 / 60);

    expect(housing.state.activeRoom).toBeNull();
  });

  it("should not enter house when already inside", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "house_deed" as ItemId, 1);
    housing.state.activeRoom = "living_room";
    housing.enterRequested = true;

    system.update([entity], 1 / 60);

    expect(housing.state.activeRoom).toBe("living_room");
  });

  it("should exit house", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "house_deed" as ItemId, 1);
    housing.state.activeRoom = "living_room";
    housing.exitRequested = true;

    system.update([entity], 1 / 60);

    expect(housing.state.activeRoom).toBeNull();
  });

  it("should not exit when not inside", () => {
    const { entity, housing, system } = createHarness();
    const v = housing.version;
    housing.exitRequested = true;

    system.update([entity], 1 / 60);

    expect(housing.version).toBe(v);
  });

  it("should place furniture and consume from inventory", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "table" as ItemId, 2);
    housing.placeRequested = {
      roomType: "living_room",
      itemId: "table" as ItemId,
      x: 0,
      y: 0,
    };

    system.update([entity], 1 / 60);

    const room = housing.state.rooms.find((r) => r.type === "living_room")!;
    expect(room.furniture).toHaveLength(1);
    expect(countItem(inventory, "table" as ItemId)).toBe(1);
  });

  it("should not place furniture in locked room", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "table" as ItemId, 1);
    housing.placeRequested = {
      roomType: "bedroom",
      itemId: "table" as ItemId,
      x: 0,
      y: 0,
    };

    system.update([entity], 1 / 60);

    const room = housing.state.rooms.find((r) => r.type === "bedroom")!;
    expect(room.furniture).toHaveLength(0);
    expect(countItem(inventory, "table" as ItemId)).toBe(1);
  });

  it("should not place when item not in inventory", () => {
    const { entity, housing, system } = createHarness();
    housing.placeRequested = {
      roomType: "living_room",
      itemId: "table" as ItemId,
      x: 0,
      y: 0,
    };

    system.update([entity], 1 / 60);

    const room = housing.state.rooms.find((r) => r.type === "living_room")!;
    expect(room.furniture).toHaveLength(0);
  });

  it("should remove furniture and return to inventory", () => {
    const { entity, inventory, housing, system } = createHarness();
    const room = housing.state.rooms.find((r) => r.type === "living_room")!;
    room.furniture = [{ itemId: "lamp" as ItemId, x: 0, y: 0 }];
    housing.removeRequested = { roomType: "living_room", index: 0 };

    system.update([entity], 1 / 60);

    const updatedRoom = housing.state.rooms.find((r) => r.type === "living_room")!;
    expect(updatedRoom.furniture).toHaveLength(0);
    expect(countItem(inventory, "lamp" as ItemId)).toBe(1);
  });

  it("should unlock room when enough coins", () => {
    const { entity, wallet, housing, system } = createHarness();
    wallet.coins = 200;
    housing.unlockRequested = "bedroom";

    system.update([entity], 1 / 60);

    const room = housing.state.rooms.find((r) => r.type === "bedroom")!;
    expect(room.unlocked).toBe(true);
    expect(wallet.coins).toBe(100); // 200 - 100
  });

  it("should not unlock room with insufficient coins", () => {
    const { entity, wallet, housing, system } = createHarness();
    wallet.coins = 50;
    housing.unlockRequested = "study"; // costs 150

    system.update([entity], 1 / 60);

    const room = housing.state.rooms.find((r) => r.type === "study")!;
    expect(room.unlocked).toBe(false);
    expect(wallet.coins).toBe(50);
  });

  it("should not unlock already-unlocked room", () => {
    const { entity, wallet, housing, system } = createHarness();
    wallet.coins = 200;
    housing.unlockRequested = "living_room"; // already unlocked

    system.update([entity], 1 / 60);

    expect(wallet.coins).toBe(200);
  });

  it("should update happiness when placing furniture", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "table" as ItemId, 1);
    housing.placeRequested = {
      roomType: "living_room",
      itemId: "table" as ItemId,
      x: 0,
      y: 0,
    };

    system.update([entity], 1 / 60);

    expect(housing.state.happiness).toBeGreaterThan(0);
  });

  it("should bump version on enter", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "house_deed" as ItemId, 1);
    const v = housing.version;
    housing.enterRequested = true;
    system.update([entity], 1 / 60);
    expect(housing.version).toBeGreaterThan(v);
  });

  it("should bump version on placement", () => {
    const { entity, inventory, housing, system } = createHarness();
    addItem(inventory, "lamp" as ItemId, 1);
    const v = housing.version;
    housing.placeRequested = {
      roomType: "living_room",
      itemId: "lamp" as ItemId,
      x: 2,
      y: 2,
    };
    system.update([entity], 1 / 60);
    expect(housing.version).toBeGreaterThan(v);
  });
});
