import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthorityResult } from "@worldnest/database";
import type {
  Entity,
  QuestComponent,
  ShopComponent,
  WalletComponent,
} from "@worldnest/game-engine";
import { STARTING_COINS } from "@worldnest/shared";
import {
  AuthorityBridge,
  createAuthorityBridge,
  type AuthorityClient,
} from "../game/AuthorityBridge";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  type GameBootstrap,
} from "../game/createGameWorld";

const BOOTSTRAP: GameBootstrap = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
  worldId: "world-1",
};

const OPERATION_ID = "aaaaaaaa-0000-4000-8000-000000000001";

type Answer = { data: AuthorityResult; error: Error | null };

function ok(coins: number): Answer {
  return { data: { ok: true, coins, reason: null }, error: null };
}

function refused(reason: string, coins: number | null = null): Answer {
  return { data: { ok: false, coins, reason }, error: null };
}

function failed(reason = "network"): Answer {
  return {
    data: { ok: false, coins: null, reason: "unreachable" },
    error: new Error(reason),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function stubClient(answer: Answer): AuthorityClient {
  return {
    shopTrade: vi.fn(async () => answer),
    claimQuestReward: vi.fn(async () => answer),
  };
}

function startBridge(
  client: AuthorityClient,
  bootstrap: GameBootstrap = BOOTSTRAP,
): {
  bridge: AuthorityBridge;
  entity: Entity;
  shop: ShopComponent;
  quest: QuestComponent;
  wallet: WalletComponent;
  reconciled: number[];
} {
  const context = createGameWorld(bootstrap);
  const entity = context.playerEntity;
  const reconciled: number[] = [];
  const bridge = new AuthorityBridge(
    entity,
    client,
    (coins) => reconciled.push(coins),
    () => OPERATION_ID,
  );

  return {
    bridge,
    entity,
    shop: entity.getComponent<ShopComponent>("shop")!,
    quest: entity.getComponent<QuestComponent>("quest")!,
    wallet: entity.getComponent<WalletComponent>("wallet")!,
    reconciled,
  };
}

function acceptTrade(shop: ShopComponent): void {
  shop.lastTrade = { kind: "buy", itemId: "wood", quantity: 2 };
  shop.tradeSeq += 1;
}

function completeQuest(quest: QuestComponent): void {
  quest.entries = { collect_wood: { state: "completed", progress: 5 } };
  quest.version += 1;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AuthorityBridge ordering", () => {
  it("does nothing when no authority operation happened", () => {
    const client = stubClient(ok(50));
    const { bridge } = startBridge(client);

    bridge.update();
    bridge.update();

    expect(client.shopTrade).not.toHaveBeenCalled();
    expect(client.claimQuestReward).not.toHaveBeenCalled();
  });

  it("serializes trade before quest so deferred answers cannot reconcile backward", async () => {
    const tradeAnswer = deferred<Answer>();
    const questAnswer = deferred<Answer>();
    const client: AuthorityClient = {
      shopTrade: vi.fn(() => tradeAnswer.promise),
      claimQuestReward: vi.fn(() => questAnswer.promise),
    };
    const { bridge, shop, quest, reconciled } = startBridge(client);

    acceptTrade(shop);
    completeQuest(quest);
    bridge.update();

    expect(client.shopTrade).toHaveBeenCalledWith(OPERATION_ID, "buy", "wood", 2);
    expect(client.claimQuestReward).not.toHaveBeenCalled();

    tradeAnswer.resolve(ok(34));
    await vi.waitFor(() => expect(client.claimQuestReward).toHaveBeenCalled());
    expect(client.claimQuestReward).toHaveBeenCalledWith("collect_wood", 5);
    questAnswer.resolve(ok(64));

    await vi.waitFor(() => expect(reconciled).toEqual([34, 64]));
  });

  it("uses a fresh operation id for each accepted trade", async () => {
    const ids = [
      "aaaaaaaa-0000-4000-8000-000000000001",
      "aaaaaaaa-0000-4000-8000-000000000002",
    ];
    const client = stubClient(ok(44));
    const context = createGameWorld(BOOTSTRAP);
    const shop = context.playerEntity.getComponent<ShopComponent>("shop")!;
    const bridge = new AuthorityBridge(
      context.playerEntity,
      client,
      () => undefined,
      () => ids.shift()!,
    );

    acceptTrade(shop);
    bridge.update();
    await vi.waitFor(() => expect(client.shopTrade).toHaveBeenCalledTimes(1));
    acceptTrade(shop);
    bridge.update();
    await vi.waitFor(() => expect(client.shopTrade).toHaveBeenCalledTimes(2));

    expect(vi.mocked(client.shopTrade).mock.calls.map(([id]) => id)).toEqual([
      "aaaaaaaa-0000-4000-8000-000000000001",
      "aaaaaaaa-0000-4000-8000-000000000002",
    ]);
  });
});

describe("AuthorityBridge retries", () => {
  it("retries a transport failure with the same trade operation id", async () => {
    vi.useFakeTimers();
    const client: AuthorityClient = {
      shopTrade: vi
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(ok(44)),
      claimQuestReward: vi.fn(async () => ok(1)),
    };
    const { bridge, shop, reconciled } = startBridge(client);

    acceptTrade(shop);
    bridge.update();
    await vi.waitFor(() => expect(client.shopTrade).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(100);

    expect(client.shopTrade).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.shopTrade).mock.calls[0]?.[0]).toBe(OPERATION_ID);
    expect(vi.mocked(client.shopTrade).mock.calls[1]?.[0]).toBe(OPERATION_ID);
    expect(reconciled).toEqual([44]);
  });

  it("retries a rate-limited quest and never duplicates it while in flight", async () => {
    vi.useFakeTimers();
    const pending = deferred<Answer>();
    const client: AuthorityClient = {
      shopTrade: vi.fn(async () => ok(1)),
      claimQuestReward: vi
        .fn()
        .mockImplementationOnce(() => pending.promise)
        .mockResolvedValueOnce(ok(80)),
    };
    const { bridge, quest, reconciled } = startBridge(client);

    completeQuest(quest);
    bridge.update();
    quest.version += 1;
    bridge.update();
    expect(client.claimQuestReward).toHaveBeenCalledTimes(1);

    pending.resolve(refused("rate_limited", 50));
    await vi.waitFor(() => expect(reconciled).toEqual([50]));
    await vi.advanceTimersByTimeAsync(100);

    expect(client.claimQuestReward).toHaveBeenCalledTimes(2);
    expect(client.claimQuestReward).toHaveBeenNthCalledWith(1, "collect_wood", 5);
    expect(client.claimQuestReward).toHaveBeenNthCalledWith(2, "collect_wood", 5);
    expect(reconciled).toEqual([50, 80]);
  });

  it("retries a failed quest call instead of marking it terminal", async () => {
    vi.useFakeTimers();
    const client: AuthorityClient = {
      shopTrade: vi.fn(async () => ok(1)),
      claimQuestReward: vi
        .fn()
        .mockResolvedValueOnce(failed())
        .mockResolvedValueOnce(ok(75)),
    };
    const { bridge, quest } = startBridge(client);

    completeQuest(quest);
    bridge.update();
    await vi.waitFor(() => expect(client.claimQuestReward).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(100);

    expect(client.claimQuestReward).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending retry on destroy", async () => {
    vi.useFakeTimers();
    const client: AuthorityClient = {
      shopTrade: vi.fn(async () => failed()),
      claimQuestReward: vi.fn(async () => ok(1)),
    };
    const { bridge, shop } = startBridge(client);

    acceptTrade(shop);
    bridge.update();
    await vi.waitFor(() => expect(client.shopTrade).toHaveBeenCalledTimes(1));
    bridge.destroy();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(client.shopTrade).toHaveBeenCalledTimes(1);
  });
});

describe("AuthorityBridge reconciliation", () => {
  it("reconciles a refusal balance", async () => {
    const client = stubClient(refused("insufficient_coins", 3));
    const { bridge, shop, reconciled } = startBridge(client);

    acceptTrade(shop);
    bridge.update();

    await vi.waitFor(() => expect(reconciled).toEqual([3]));
  });

  it("marks already-completed quests terminal and reconciles their balance", async () => {
    const client = stubClient(refused("already_completed", 75));
    const { bridge, quest, reconciled } = startBridge(client);

    completeQuest(quest);
    bridge.update();
    await vi.waitFor(() => expect(reconciled).toEqual([75]));
    quest.version += 1;
    bridge.update();

    expect(client.claimQuestReward).toHaveBeenCalledTimes(1);
  });

  it("does not reclaim a restored completed quest", () => {
    const client = stubClient(ok(75));
    const { bridge, quest } = startBridge(client, {
      ...BOOTSTRAP,
      quests: { collect_wood: { state: "completed", progress: 5 } },
    });

    quest.version += 1;
    bridge.update();

    expect(client.claimQuestReward).not.toHaveBeenCalled();
  });

  it("writes only requestedBalance and lets ShopSystem apply it", async () => {
    const client = stubClient(ok(9));
    const context = createGameWorld(BOOTSTRAP);
    const wallet = context.playerEntity.getComponent<WalletComponent>("wallet")!;
    const shop = context.playerEntity.getComponent<ShopComponent>("shop")!;
    const bridge = new AuthorityBridge(
      context.playerEntity,
      client,
      (coins) => {
        wallet.requestedBalance = coins;
      },
      () => OPERATION_ID,
    );

    acceptTrade(shop);
    bridge.update();
    await vi.waitFor(() => expect(wallet.requestedBalance).toBe(9));
    expect(wallet.coins).toBe(STARTING_COINS);

    context.world.update(1 / 60);
    expect(wallet.coins).toBe(9);
    expect(wallet.adjustments).toBe(1);
    expect(wallet.requestedBalance).toBeNull();
  });
});

describe("AuthorityBridge factory", () => {
  it("does not create a bridge without a persisted world", () => {
    const bootstrap = { ...BOOTSTRAP, worldId: null };

    expect(createAuthorityBridge(bootstrap, createGameWorld(bootstrap))).toBeNull();
  });

  it("survives an unconfigured backend", () => {
    const context = createGameWorld(BOOTSTRAP);
    const bridge = createAuthorityBridge(BOOTSTRAP, context)!;
    const shop = context.playerEntity.getComponent<ShopComponent>("shop")!;
    const wallet = context.playerEntity.getComponent<WalletComponent>("wallet")!;

    acceptTrade(shop);

    expect(() => bridge.update()).not.toThrow();
    expect(wallet.coins).toBe(STARTING_COINS);
    bridge.destroy();
  });
});
