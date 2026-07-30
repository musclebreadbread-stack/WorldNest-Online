import { describe, it, expect, beforeEach } from "vitest";
import { INVENTORY_SLOTS } from "@worldnest/shared";
import type { InventorySlot } from "@worldnest/game-engine";
import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";
import { useUIStore } from "../stores/uiStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: true, session: null });
  });

  it("should set the user", () => {
    useAuthStore.getState().setUser({
      id: "u1",
      email: "u1@example.com",
      username: "u1",
    });

    expect(useAuthStore.getState().user?.id).toBe("u1");
  });

  it("should clear user, session and loading together", () => {
    const store = useAuthStore.getState();
    store.setUser({ id: "u1", email: "u1@example.com", username: "u1" });
    store.setSession({ access_token: "token" });

    useAuthStore.getState().clear();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.loading).toBe(false);
  });
});

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.setState({
      playerX: 0,
      playerY: 0,
      chunkX: 0,
      chunkY: 0,
      onlinePlayers: new Map(),
      connectionStatus: "disconnected",
      inventorySlots: new Array<InventorySlot | null>(INVENTORY_SLOTS).fill(null),
      selectedSlot: 0,
    });
  });

  it("should set the player position and chunk", () => {
    useGameStore.getState().setPlayerPosition(120, 240, 1, 2);

    const state = useGameStore.getState();
    expect(state.playerX).toBe(120);
    expect(state.playerY).toBe(240);
    expect(state.chunkX).toBe(1);
    expect(state.chunkY).toBe(2);
  });

  it("should add an online player without mutating the previous map", () => {
    const before = useGameStore.getState().onlinePlayers;

    useGameStore
      .getState()
      .addOnlinePlayer({ playerId: "p1", username: "One", x: 10, y: 20 });

    const after = useGameStore.getState().onlinePlayers;
    expect(after).not.toBe(before);
    expect(before.size).toBe(0);
    expect(after.get("p1")).toEqual({
      playerId: "p1",
      username: "One",
      x: 10,
      y: 20,
    });
  });

  it("should remove an online player", () => {
    const store = useGameStore.getState();
    store.addOnlinePlayer({ playerId: "p1", username: "One", x: 0, y: 0 });
    store.addOnlinePlayer({ playerId: "p2", username: "Two", x: 0, y: 0 });

    useGameStore.getState().removeOnlinePlayer("p1");

    const players = useGameStore.getState().onlinePlayers;
    expect(players.has("p1")).toBe(false);
    expect(players.size).toBe(1);
  });

  it("should update an online player's position immutably", () => {
    useGameStore
      .getState()
      .addOnlinePlayer({ playerId: "p1", username: "One", x: 0, y: 0 });
    const previous = useGameStore.getState().onlinePlayers.get("p1")!;

    useGameStore.getState().updateOnlinePlayer("p1", 64, 96);

    const updated = useGameStore.getState().onlinePlayers.get("p1")!;
    expect(updated).not.toBe(previous);
    expect(previous.x).toBe(0);
    expect(updated).toEqual({ playerId: "p1", username: "One", x: 64, y: 96 });
  });

  it("should ignore updates for unknown players", () => {
    useGameStore.getState().updateOnlinePlayer("ghost", 1, 1);

    expect(useGameStore.getState().onlinePlayers.size).toBe(0);
  });

  it("should set the connection status", () => {
    useGameStore.getState().setConnectionStatus("connected");

    expect(useGameStore.getState().connectionStatus).toBe("connected");
  });

  it("should copy inventory slots instead of holding the engine's array", () => {
    const slots: Array<InventorySlot | null> = new Array(INVENTORY_SLOTS).fill(null);
    slots[0] = { itemId: "wood", quantity: 3 };

    useGameStore.getState().setInventory(slots, 2);

    const state = useGameStore.getState();
    expect(state.selectedSlot).toBe(2);
    expect(state.inventorySlots).not.toBe(slots);
    expect(state.inventorySlots[0]).not.toBe(slots[0]);
    expect(state.inventorySlots[0]).toEqual({ itemId: "wood", quantity: 3 });

    // Later engine-side mutation must not leak into the store snapshot
    slots[0]!.quantity = 99;
    expect(useGameStore.getState().inventorySlots[0]).toEqual({
      itemId: "wood",
      quantity: 3,
    });
  });

  it("should set the selected slot on its own", () => {
    useGameStore.getState().setSelectedSlot(5);

    expect(useGameStore.getState().selectedSlot).toBe(5);
  });

  it("should mirror the player's health and energy", () => {
    useGameStore
      .getState()
      .setStats({ health: 80, maxHealth: 100, energy: 42, maxEnergy: 100 });

    const state = useGameStore.getState();
    expect(state.health).toBe(80);
    expect(state.energy).toBe(42);
    expect(state.maxEnergy).toBe(100);
  });
});

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      clock: null,
      inventoryOpen: false,
      buildMode: false,
      minimapOpen: true,
      settingsOpen: false,
    });
  });

  it("should store the latest clock snapshot", () => {
    useUIStore.getState().setClock({
      totalMinutes: 90,
      day: 1,
      hour: 1,
      minute: 30,
      phase: "night",
    });

    expect(useUIStore.getState().clock?.hour).toBe(1);
  });

  it("should toggle and explicitly set the inventory panel", () => {
    useUIStore.getState().toggleInventory();
    expect(useUIStore.getState().inventoryOpen).toBe(true);

    useUIStore.getState().toggleInventory();
    expect(useUIStore.getState().inventoryOpen).toBe(false);

    useUIStore.getState().setInventoryOpen(true);
    expect(useUIStore.getState().inventoryOpen).toBe(true);
  });

  it("should toggle and explicitly set build mode", () => {
    useUIStore.getState().toggleBuildMode();
    expect(useUIStore.getState().buildMode).toBe(true);

    useUIStore.getState().toggleBuildMode();
    expect(useUIStore.getState().buildMode).toBe(false);

    useUIStore.getState().setBuildMode(true);
    expect(useUIStore.getState().buildMode).toBe(true);
    // Build mode is independent of the inventory panel
    expect(useUIStore.getState().inventoryOpen).toBe(false);
  });

  it("should start with the minimap open and toggle it", () => {
    expect(useUIStore.getState().minimapOpen).toBe(true);

    useUIStore.getState().toggleMinimap();
    expect(useUIStore.getState().minimapOpen).toBe(false);

    useUIStore.getState().toggleMinimap();
    expect(useUIStore.getState().minimapOpen).toBe(true);
  });

  it("should set the minimap explicitly without touching other panels", () => {
    useUIStore.getState().setMinimapOpen(false);

    const state = useUIStore.getState();
    expect(state.minimapOpen).toBe(false);
    expect(state.inventoryOpen).toBe(false);
    expect(state.buildMode).toBe(false);
  });

  it("should toggle and explicitly set the settings panel", () => {
    useUIStore.getState().toggleSettings();
    expect(useUIStore.getState().settingsOpen).toBe(true);

    useUIStore.getState().toggleSettings();
    expect(useUIStore.getState().settingsOpen).toBe(false);

    useUIStore.getState().setSettingsOpen(true);
    const state = useUIStore.getState();
    expect(state.settingsOpen).toBe(true);
    // Opening settings leaves the rest of the HUD as it was
    expect(state.inventoryOpen).toBe(false);
    expect(state.minimapOpen).toBe(true);
  });
});
