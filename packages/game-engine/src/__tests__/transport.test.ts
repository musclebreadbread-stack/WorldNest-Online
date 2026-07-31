import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { TransportComponent } from "../components/TransportComponent";
import { TransportSystem } from "../systems/TransportSystem";
import { addItem } from "../inventory/inventoryOps";
import {
  BOAT_SPEED_MULTIPLIER,
  MOUNT_DEFINITIONS,
  MOUNT_FEED_RESTORE,
  MOUNT_STAMINA_DRAIN_PER_SECOND,
  boatCanTraverse,
  calculateSpeed,
  canBoard,
  canMount,
  dismount,
  feedMount,
  getMountBondLevel,
  isMountExhausted,
  mount,
  tickMountStamina,
} from "../transport";

function createHarness(onFirstRide?: () => void) {
  const inventory = new InventoryComponent();
  const stats = new StatsComponent();
  const position = new PositionComponent();
  const interaction = new InteractionComponent();
  const transport = new TransportComponent();
  const entity = new Entity("player")
    .addComponent(inventory)
    .addComponent(stats)
    .addComponent(position)
    .addComponent(interaction)
    .addComponent(transport);
  const system = new TransportSystem(onFirstRide);
  return { entity, transport, inventory, stats, system };
}
describe("canMount", () => {
  it("returns null without required items", () => {
    expect(canMount(new InventoryComponent())).toBeNull();
    const inv = new InventoryComponent();
    addItem(inv, "mount_saddle", 1);
    expect(canMount(inv)).toBeNull();
    const inv2 = new InventoryComponent();
    addItem(inv2, "horse_whistle", 1);
    expect(canMount(inv2)).toBeNull();
  });

  it("returns species when saddle and whistle present", () => {
    const inv = new InventoryComponent();
    addItem(inv, "mount_saddle", 1);
    addItem(inv, "horse_whistle", 1);
    expect(canMount(inv)).toBe("horse");
  });

  it("detects each mount species", () => {
    for (const [whistle, species] of [
      ["donkey_whistle", "donkey"],
      ["camel_whistle", "camel"],
    ] as const) {
      const inv = new InventoryComponent();
      addItem(inv, "mount_saddle", 1);
      addItem(inv, whistle, 1);
      expect(canMount(inv)).toBe(species);
    }
  });
});

describe("canBoard", () => {
  it("returns false without boat or when not facing water", () => {
    expect(canBoard(new InventoryComponent(), true)).toBe(false);
    const inv = new InventoryComponent();
    addItem(inv, "boat", 1);
    expect(canBoard(inv, false)).toBe(false);
  });

  it("returns true with boat and facing water", () => {
    const inv = new InventoryComponent();
    addItem(inv, "boat", 1);
    expect(canBoard(inv, true)).toBe(true);
  });
});

describe("mount/dismount", () => {
  it("creates mount state with correct species stats", () => {
    const state = mount("horse");
    expect(state.species).toBe("horse");
    expect(state.stamina).toBe(MOUNT_DEFINITIONS.horse.stamina);
    expect(state.maxStamina).toBe(MOUNT_DEFINITIONS.horse.stamina);
    expect(state.bondLevel).toBe(0);
    expect(state.feedCount).toBe(0);
  });

  it("creates donkey mount with higher stamina", () => {
    expect(mount("donkey").stamina).toBe(150);
  });

  it("dismount returns walking mode", () => {
    expect(dismount()).toBe("walking");
  });
});

describe("tickMountStamina", () => {
  it("drains stamina proportionally and clamps to 0", () => {
    expect(tickMountStamina(100, 1)).toBe(100 - MOUNT_STAMINA_DRAIN_PER_SECOND);
    expect(tickMountStamina(1, 10)).toBe(0);
    expect(tickMountStamina(100, 0.5)).toBe(100 - MOUNT_STAMINA_DRAIN_PER_SECOND * 0.5);
  });
});

describe("feedMount", () => {
  it("restores stamina and increases feed count", () => {
    const state = mount("horse");
    state.stamina = 50;
    const fed = feedMount(state);
    expect(fed.stamina).toBe(50 + MOUNT_FEED_RESTORE);
    expect(fed.feedCount).toBe(1);
  });

  it("does not exceed max stamina", () => {
    const state = mount("horse");
    state.stamina = 90;
    expect(feedMount(state).stamina).toBe(state.maxStamina);
  });

  it("increases bond level at thresholds", () => {
    const state = mount("horse");
    state.feedCount = 4;
    expect(feedMount(state).bondLevel).toBe(1);
  });
});

describe("calculateSpeed", () => {
  it("returns 1 for walking", () => {
    expect(calculateSpeed("walking", null)).toBe(1);
  });

  it("returns boat multiplier for boating", () => {
    expect(calculateSpeed("boating", null)).toBe(BOAT_SPEED_MULTIPLIER);
  });

  it("returns mount-specific multiplier when mounted", () => {
    expect(calculateSpeed("mounted", mount("horse"))).toBe(2.0);
    expect(calculateSpeed("mounted", mount("donkey"))).toBe(1.5);
    expect(calculateSpeed("mounted", mount("camel"))).toBe(1.8);
  });
});

describe("isMountExhausted", () => {
  it("returns true at 0 stamina and false otherwise", () => {
    const state = mount("horse");
    expect(isMountExhausted(state)).toBe(false);
    state.stamina = 0;
    expect(isMountExhausted(state)).toBe(true);
  });
});

describe("getMountBondLevel", () => {
  it("returns correct levels at thresholds", () => {
    expect(getMountBondLevel(0)).toBe(0);
    expect(getMountBondLevel(4)).toBe(0);
    expect(getMountBondLevel(5)).toBe(1);
    expect(getMountBondLevel(14)).toBe(1);
    expect(getMountBondLevel(15)).toBe(2);
    expect(getMountBondLevel(100)).toBe(2);
  });
});

describe("boatCanTraverse", () => {
  it("allows water tiles only", () => {
    expect(boatCanTraverse(true)).toBe(true);
    expect(boatCanTraverse(false)).toBe(false);
  });
});

describe("TransportSystem", () => {
  it("requires the correct components", () => {
    const { system, entity } = createHarness();
    expect(system.matches(entity)).toBe(true);
    const partial = new Entity("npc").addComponent(new InventoryComponent());
    expect(system.matches(partial)).toBe(false);
  });

  it("processes walking state without errors", () => {
    const { system, entity, transport } = createHarness();
    system.update([entity], 1 / 60);
    expect(transport.mode).toBe("walking");
  });

  it("drains stamina while mounted", () => {
    const { system, entity, transport } = createHarness();
    transport.mode = "mounted";
    transport.mountState = mount("horse");
    const before = transport.mountState.stamina;
    system.update([entity], 1);
    expect(transport.mountState!.stamina).toBeLessThan(before);
  });

  it("forces dismount on exhaustion", () => {
    const { system, entity, transport } = createHarness();
    transport.mode = "mounted";
    transport.mountState = mount("horse");
    transport.mountState.stamina = 1;
    system.update([entity], 10);
    expect(transport.mode).toBe("walking");
    expect(transport.mountState).toBeNull();
  });

  it("requestMount succeeds with saddle and whistle", () => {
    let calls = 0;
    const { system, transport, inventory } = createHarness(() => calls++);
    addItem(inventory, "mount_saddle", 1);
    addItem(inventory, "horse_whistle", 1);
    expect(system.requestMount(transport, inventory)).toBe(true);
    expect(transport.mode).toBe("mounted");
    expect(transport.mountState?.species).toBe("horse");
    expect(calls).toBe(1);
  });

  it("requestMount fails without items or if already mounted", () => {
    const { system, transport, inventory } = createHarness();
    expect(system.requestMount(transport, inventory)).toBe(false);
    addItem(inventory, "mount_saddle", 1);
    addItem(inventory, "horse_whistle", 1);
    transport.mode = "mounted";
    transport.mountState = mount("horse");
    expect(system.requestMount(transport, inventory)).toBe(false);
  });

  it("requestDismount transitions and fails if not mounted", () => {
    const { system, transport } = createHarness();
    expect(system.requestDismount(transport)).toBe(false);
    transport.mode = "mounted";
    transport.mountState = mount("horse");
    expect(system.requestDismount(transport)).toBe(true);
    expect(transport.mode).toBe("walking");
    expect(transport.mountState).toBeNull();
  });

  it("requestBoard succeeds with boat facing water", () => {
    const { system, transport, inventory } = createHarness();
    addItem(inventory, "boat", 1);
    expect(system.requestBoard(transport, inventory, true)).toBe(true);
    expect(transport.mode).toBe("boating");
    expect(transport.boatActive).toBe(true);
  });

  it("requestBoard fails without boat or facing land", () => {
    const { system, transport, inventory } = createHarness();
    expect(system.requestBoard(transport, inventory, true)).toBe(false);
    addItem(inventory, "boat", 1);
    expect(system.requestBoard(transport, inventory, false)).toBe(false);
  });

  it("requestDisembark transitions and fails if not boating", () => {
    const { system, transport } = createHarness();
    expect(system.requestDisembark(transport)).toBe(false);
    transport.mode = "boating";
    transport.boatActive = true;
    expect(system.requestDisembark(transport)).toBe(true);
    expect(transport.mode).toBe("walking");
    expect(transport.boatActive).toBe(false);
  });

  it("requestFeed restores stamina and fails when invalid", () => {
    const { system, transport, inventory } = createHarness();
    addItem(inventory, "animal_feed", 5);
    expect(system.requestFeed(transport, inventory)).toBe(false);
    transport.mode = "mounted";
    transport.mountState = mount("horse");
    transport.mountState.stamina = 50;
    expect(system.requestFeed(transport, inventory)).toBe(true);
    expect(transport.mountState!.stamina).toBe(50 + MOUNT_FEED_RESTORE);
    expect(transport.mountState!.feedCount).toBe(1);
  });

  it("requestFeed fails without animal_feed", () => {
    const { system, transport, inventory } = createHarness();
    transport.mode = "mounted";
    transport.mountState = mount("horse");
    expect(system.requestFeed(transport, inventory)).toBe(false);
  });

  it("increments version on state changes", () => {
    const { system, transport, inventory } = createHarness();
    addItem(inventory, "mount_saddle", 1);
    addItem(inventory, "horse_whistle", 1);
    expect(transport.version).toBe(0);
    system.requestMount(transport, inventory);
    expect(transport.version).toBe(1);
    system.requestDismount(transport);
    expect(transport.version).toBe(2);
  });
});
