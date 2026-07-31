import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuestComponent } from "@worldnest/game-engine";
import type { WalletComponent } from "@worldnest/game-engine";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  type GameBootstrap,
} from "../game/createGameWorld";
import { createSessionPersistence } from "../game/SessionPersistence";

// The only module mock in the suite, and it earns its keep: `SessionPersistence`
// exists to make database calls, so the calls themselves are what has to be
// asserted. Everything the real module exports and this file touches is stubbed.
// The factory is hoisted above every top-level binding, so the "write
// succeeded" stub has to be written out inside it rather than shared.
vi.mock("@worldnest/database", () => {
  const ok = () => vi.fn(async () => ({ data: null, error: null }));
  return {
    savePlayerState: ok(),
    saveQuests: ok(),
    saveWorldModification: ok(),
    saveStructure: ok(),
    deleteStructure: ok(),
    saveCrop: ok(),
    deleteCrop: ok(),
  };
});

const { savePlayerState, saveQuests } = await import("@worldnest/database");

const BOOTSTRAP: GameBootstrap = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
  worldId: "world-1",
};

function startSession(bootstrap: GameBootstrap = BOOTSTRAP) {
  const context = createGameWorld(bootstrap);
  const persistence = createSessionPersistence(bootstrap, context)!;
  const wallet = context.playerEntity.getComponent<WalletComponent>("wallet")!;
  const quests = context.playerEntity.getComponent<QuestComponent>("quest")!;

  return { context, persistence, wallet, quests };
}

describe("SessionPersistence", () => {
  beforeEach(() => {
    vi.mocked(savePlayerState).mockClear();
    vi.mocked(saveQuests).mockClear();
  });

  it("should not persist anything without a world id", () => {
    const bootstrap = { ...BOOTSTRAP, worldId: null };

    expect(createSessionPersistence(bootstrap, createGameWorld(bootstrap))).toBeNull();
  });

  it("should never send the coin balance with the player row", () => {
    const { persistence, wallet } = startSession();

    wallet.coins = 137;
    persistence.flush();

    // The column is not writable by a signed-in client any more, and Postgres
    // refuses the whole upsert over one ungranted column — so naming coins here
    // would silently stop position and inventory persisting too.
    const [, payload] = vi.mocked(savePlayerState).mock.calls[0]!;
    expect(payload).not.toHaveProperty("coins");
  });

  it("should write the quest log to its own table", () => {
    const { persistence, quests } = startSession();

    quests.entries = { collect_wood: { state: "active", progress: 3 } };
    quests.version += 1;
    persistence.flush();

    expect(saveQuests).toHaveBeenCalledWith("user-1", [
      { questId: "collect_wood", state: "active", progress: 3 },
    ]);
  });

  it("should collapse a burst of coin changes into one save per flush", () => {
    const { persistence, wallet } = startSession();

    for (let frame = 0; frame < 20; frame++) {
      wallet.coins -= 1;
      persistence.update();
    }
    persistence.flush();

    // The autosave interval has not elapsed, so the 20 marks are one write
    expect(savePlayerState).toHaveBeenCalledTimes(1);
  });

  it("should not rewrite the quest rows when only the position moved", () => {
    const { persistence, quests, context } = startSession();

    quests.entries = { greet_pip: { state: "completed", progress: 1 } };
    quests.version += 1;
    persistence.flush();
    expect(saveQuests).toHaveBeenCalledTimes(1);

    context.playerEntity.getComponent<{ x: number }>("position")!.x += 32;
    persistence.flush();

    expect(savePlayerState).toHaveBeenCalledTimes(2);
    expect(saveQuests).toHaveBeenCalledTimes(1);
  });

  it("should not rewrite a restored quest log that nothing has touched", () => {
    const { persistence } = startSession({
      ...BOOTSTRAP,
      quests: { collect_wood: { state: "active", progress: 2 } },
    });

    persistence.flush();

    expect(saveQuests).not.toHaveBeenCalled();
  });

  it("should write nothing at all while the session is unchanged", () => {
    const { persistence } = startSession();

    persistence.flush();
    vi.mocked(savePlayerState).mockClear();
    persistence.flush();

    expect(savePlayerState).not.toHaveBeenCalled();
  });
});
