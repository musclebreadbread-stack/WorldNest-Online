import { claimQuestReward, shopTrade } from "@worldnest/database";
import type { AuthorityResult } from "@worldnest/database";
import type {
  Entity,
  QuestComponent,
  ShopComponent,
  ShopTrade,
  WalletComponent,
} from "@worldnest/game-engine";
import type { GameBootstrap, GameWorldContext } from "./createGameWorld";

/** One answer from the server, in the shape `@worldnest/database` returns it. */
type AuthorityAnswer = { data: AuthorityResult; error: Error | null };

/** The authority calls this Phaser-free bridge needs. */
export interface AuthorityClient {
  shopTrade(
    operationId: string,
    kind: string,
    itemId: string,
    quantity: number,
  ): Promise<AuthorityAnswer>;
  claimQuestReward(questId: string, progress: number): Promise<AuthorityAnswer>;
}

/** How an authoritative balance gets back into the engine. */
export type BalanceReconciler = (coins: number) => void;

type QueuedOperation =
  | {
      kind: "trade";
      operationId: string;
      trade: ShopTrade;
      attempts: number;
    }
  | {
      kind: "quest";
      questId: string;
      progress: number;
      attempts: number;
    };

const RETRY_BASE_MS = 100;
const RETRY_MAX_MS = 2_000;

/**
 * Serializes optimistic economy changes through the server authority.
 *
 * ShopSystem runs before QuestSystem, so `update` enqueues the accepted trade
 * before newly completed quests. Only the queue head may call the server. That
 * makes every returned balance ordered, while a stable operation UUID makes a
 * trade retry safe when the first response was lost.
 */
export class AuthorityBridge {
  private lastTradeSeq: number;
  private lastQuestVersion: number;
  private terminalQuests = new Set<string>();
  private queuedQuests = new Set<string>();
  private queue: QueuedOperation[] = [];
  private processing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private playerEntity: Entity,
    private client: AuthorityClient,
    private reconcile: BalanceReconciler,
    private createOperationId: () => string = () => globalThis.crypto.randomUUID(),
  ) {
    const shop = playerEntity.getComponent<ShopComponent>("shop");
    const quest = playerEntity.getComponent<QuestComponent>("quest");
    this.lastTradeSeq = shop?.tradeSeq ?? 0;
    this.lastQuestVersion = quest?.version ?? 0;

    // Restored `completed` rows were written by the claim function itself, so
    // they are already paid and must not be claimed again on boot.
    for (const [questId, entry] of Object.entries(quest?.entries ?? {})) {
      if (entry.state === "completed") this.terminalQuests.add(questId);
    }
  }

  /** Detect this frame's accepted trade and quest completions. */
  update(): void {
    if (this.destroyed) return;

    this.enqueueTrade();
    this.enqueueQuests();
    void this.processNext();
  }

  /** Cancel pending retries and ignore any in-flight answer during shutdown. */
  destroy(): void {
    this.destroyed = true;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.queue = [];
    this.queuedQuests.clear();
  }

  private enqueueTrade(): void {
    const shop = this.playerEntity.getComponent<ShopComponent>("shop");
    if (!shop || shop.tradeSeq === this.lastTradeSeq) return;

    this.lastTradeSeq = shop.tradeSeq;
    if (!shop.lastTrade) return;

    this.queue.push({
      kind: "trade",
      operationId: this.createOperationId(),
      trade: { ...shop.lastTrade },
      attempts: 0,
    });
  }

  private enqueueQuests(): void {
    const quest = this.playerEntity.getComponent<QuestComponent>("quest");
    if (!quest || quest.version === this.lastQuestVersion) return;

    this.lastQuestVersion = quest.version;
    for (const [questId, entry] of Object.entries(quest.entries)) {
      if (
        entry.state !== "completed" ||
        this.terminalQuests.has(questId) ||
        this.queuedQuests.has(questId)
      ) {
        continue;
      }

      this.queuedQuests.add(questId);
      this.queue.push({
        kind: "quest",
        questId,
        progress: entry.progress,
        attempts: 0,
      });
    }
  }

  private async processNext(): Promise<void> {
    if (
      this.destroyed ||
      this.processing ||
      this.retryTimer !== null ||
      this.queue.length === 0
    ) {
      return;
    }

    const operation = this.queue[0]!;
    this.processing = true;

    let answer: AuthorityAnswer;
    try {
      answer = await this.call(operation);
    } catch (error) {
      answer = {
        data: { ok: false, coins: null, reason: "unreachable" },
        error: error instanceof Error ? error : new Error("unreachable"),
      };
    }
    this.processing = false;

    if (this.destroyed) return;
    if (answer.data.coins !== null) this.reconcile(answer.data.coins);

    if (this.shouldRetry(operation, answer)) {
      operation.attempts += 1;
      const delay = Math.min(
        RETRY_BASE_MS * 2 ** (operation.attempts - 1),
        RETRY_MAX_MS,
      );
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.processNext();
      }, delay);
      return;
    }

    this.queue.shift();
    if (operation.kind === "quest") {
      this.queuedQuests.delete(operation.questId);
      this.terminalQuests.add(operation.questId);
    }
    void this.processNext();
  }

  private call(operation: QueuedOperation): Promise<AuthorityAnswer> {
    if (operation.kind === "quest") {
      return this.client.claimQuestReward(operation.questId, operation.progress);
    }

    return this.client.shopTrade(
      operation.operationId,
      operation.trade.kind,
      operation.trade.itemId,
      operation.trade.quantity,
    );
  }

  private shouldRetry(operation: QueuedOperation, answer: AuthorityAnswer): boolean {
    if (answer.error || answer.data.reason === "rate_limited") return true;
    if (operation.kind === "trade") return false;

    // A quest is terminal only when payment succeeded or the server confirms a
    // previous payment. Any other refusal remains retryable with bounded delay.
    return !answer.data.ok && answer.data.reason !== "already_completed";
  }
}

/** Build a bridge only for sessions that reached a persisted world. */
export function createAuthorityBridge(
  bootstrap: GameBootstrap,
  context: GameWorldContext,
): AuthorityBridge | null {
  if (!bootstrap.worldId) return null;

  const wallet = context.playerEntity.getComponent<WalletComponent>("wallet");
  if (!wallet) return null;

  return new AuthorityBridge(
    context.playerEntity,
    { shopTrade, claimQuestReward },
    (coins) => {
      wallet.requestedBalance = coins;
    },
  );
}
