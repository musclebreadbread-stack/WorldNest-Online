import { activeNode, getNpcDefinition } from "@worldnest/game-engine";
import type {
  DialogueComponent,
  Entity,
  InventoryComponent,
  PositionComponent,
  ShopComponent,
  StatsComponent,
  TimeComponent,
  WalletComponent,
} from "@worldnest/game-engine";
import {
  CLOCK_CHANGED_EVENT,
  DIALOGUE_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  PLAYER_POSITION_EVENT,
  SHOP_CHANGED_EVENT,
  STATS_CHANGED_EVENT,
  WALLET_CHANGED_EVENT,
  type DialogueChangedEvent,
  type InventoryChangedEvent,
  type PlayerPositionEvent,
  type ShopChangedEvent,
  type StatsChangedEvent,
  type WalletChangedEvent,
} from "./events";

/** The slice of Phaser's event emitter the bridge needs, so it stays Phaser-free. */
export interface HudEventEmitter {
  emit(event: string, payload: unknown): unknown;
}

/**
 * HudBridge pushes ECS state to React as `game.events`.
 * It keeps the last emitted values so slow-changing state (the world clock) is
 * only published when it actually changes, instead of 60 times a second.
 */
export class HudBridge {
  private emitter: HudEventEmitter;
  private playerEntity: Entity;
  private clockEntity: Entity;
  private lastClockMinutes = -1;
  private lastInventoryVersion = -1;
  private lastHealth = -1;
  private lastEnergy = -1;
  /** Starts at the component's own initial version, so a closed conversation
   * publishes nothing on the first frame. */
  private lastDialogueVersion = 0;
  private lastCoins = -1;
  /** Same rule as the dialogue version: an untouched shop publishes nothing. */
  private lastShopVersion = 0;

  constructor(emitter: HudEventEmitter, playerEntity: Entity, clockEntity: Entity) {
    this.emitter = emitter;
    this.playerEntity = playerEntity;
    this.clockEntity = clockEntity;
  }

  /** Emit everything that changed. Call once per frame, after the ECS update. */
  flush(): void {
    this.emitPosition();
    this.emitClock();
    this.emitInventory();
    this.emitStats();
    this.emitDialogue();
    this.emitWallet();
    this.emitShop();
  }

  private emitPosition(): void {
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    const payload: PlayerPositionEvent = {
      x: position.x,
      y: position.y,
      chunkX: position.chunkX,
      chunkY: position.chunkY,
    };
    this.emitter.emit(PLAYER_POSITION_EVENT, payload);
  }

  private emitClock(): void {
    const snapshot = this.clockEntity.getComponent<TimeComponent>("time")!.snapshot;
    if (snapshot.totalMinutes === this.lastClockMinutes) return;

    this.lastClockMinutes = snapshot.totalMinutes;
    this.emitter.emit(CLOCK_CHANGED_EVENT, snapshot);
  }

  private emitInventory(): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory")!;
    if (inventory.version === this.lastInventoryVersion) return;

    this.lastInventoryVersion = inventory.version;
    const payload: InventoryChangedEvent = {
      slots: inventory.slots,
      selectedSlot: inventory.selectedSlot,
    };
    this.emitter.emit(INVENTORY_CHANGED_EVENT, payload);
  }

  /**
   * Energy regenerates continuously, so the bars are published on whole-point
   * changes only — that is all the HUD can display anyway.
   */
  private emitStats(): void {
    const stats = this.playerEntity.getComponent<StatsComponent>("stats")!;
    const health = Math.round(stats.health);
    const energy = Math.round(stats.energy);
    if (health === this.lastHealth && energy === this.lastEnergy) return;

    this.lastHealth = health;
    this.lastEnergy = energy;
    const payload: StatsChangedEvent = {
      health,
      maxHealth: stats.maxHealth,
      energy,
      maxEnergy: stats.maxEnergy,
    };
    this.emitter.emit(STATS_CHANGED_EVENT, payload);
  }

  /** Coins are a single integer, so the balance itself is the change detector. */
  private emitWallet(): void {
    const wallet = this.playerEntity.getComponent<WalletComponent>("wallet");
    if (!wallet || wallet.coins === this.lastCoins) return;

    this.lastCoins = wallet.coins;
    const payload: WalletChangedEvent = { coins: wallet.coins };
    this.emitter.emit(WALLET_CHANGED_EVENT, payload);
  }

  /**
   * Publish the open shop whenever `ShopSystem` accepted a change.
   *
   * A completed trade bumps the same version, which is what lets the panel
   * re-render its "held" column off one event instead of polling the inventory.
   */
  private emitShop(): void {
    const shop = this.playerEntity.getComponent<ShopComponent>("shop");
    if (!shop || shop.version === this.lastShopVersion) return;

    this.lastShopVersion = shop.version;
    const definition = shop.openNpcId ? getNpcDefinition(shop.openNpcId) : undefined;
    const payload: ShopChangedEvent = {
      openNpcId: shop.openNpcId,
      nameKey: definition?.nameKey ?? null,
    };
    this.emitter.emit(SHOP_CHANGED_EVENT, payload);
  }

  /**
   * Publish the active conversation whenever `NpcSystem` accepted a change.
   *
   * The node is resolved here rather than in React so the panel never needs the
   * dialogue graph, and what crosses is keys only — the panel translates them.
   */
  private emitDialogue(): void {
    const dialogue = this.playerEntity.getComponent<DialogueComponent>("dialogue");
    if (!dialogue || dialogue.version === this.lastDialogueVersion) return;

    this.lastDialogueVersion = dialogue.version;
    const node = activeNode(dialogue);
    const definition = dialogue.activeNpcId
      ? getNpcDefinition(dialogue.activeNpcId)
      : undefined;
    const payload: DialogueChangedEvent = {
      npcId: dialogue.activeNpcId,
      nameKey: definition?.nameKey ?? null,
      textKey: node?.textKey ?? null,
      options: node?.options ?? [],
    };
    this.emitter.emit(DIALOGUE_CHANGED_EVENT, payload);
  }
}
