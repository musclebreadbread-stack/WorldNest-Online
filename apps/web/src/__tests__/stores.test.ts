import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";

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
});
