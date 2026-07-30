import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type {
  DialogueComponent,
  InventorySlot,
  ShopComponent,
  ShopTradeKind,
} from "@worldnest/game-engine";
import { ITEM_PRICES, STARTING_COINS, type ItemId } from "@worldnest/shared";
import { CoinCounter } from "../components/CoinCounter";
import { ShopPanel } from "../components/ShopPanel";
import { wireDialogue } from "../game/DialogueBridge";
import { wireShop } from "../game/ShopBridge";
import { HudBridge, type HudEventEmitter } from "../game/HudBridge";
import { closeTopmostPanel, isHudModal } from "../game/panelStack";
import {
  SHOP_CHANGED_EVENT,
  WALLET_CHANGED_EVENT,
  type ShopChangedEvent,
  type WalletChangedEvent,
} from "../game/events";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
} from "../game/createGameWorld";
import { DEFAULT_LOCALE } from "../i18n";
import { en } from "../i18n/messages/en";
import { useDialogueStore } from "../stores/dialogueStore";
import { useGameStore } from "../stores/gameStore";
import { useLocaleStore } from "../stores/localeStore";
import { useShopStore, isShopOpen } from "../stores/shopStore";
import { useUIStore } from "../stores/uiStore";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

const WOOD = ITEM_PRICES.wood!;

class RecordingEmitter implements HudEventEmitter {
  public events: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown): unknown {
    this.events.push({ event, payload });
    return true;
  }

  payloads<T>(event: string): T[] {
    return this.events
      .filter((entry) => entry.event === event)
      .map((entry) => entry.payload as T);
  }
}

function resetShopStore(): void {
  useShopStore.setState({
    openNpcId: null,
    nameKey: null,
    trader: null,
    opener: null,
    closer: null,
  });
}

function resetDialogueStore(): void {
  useDialogueStore.setState({
    npcId: null,
    nameKey: null,
    textKey: null,
    options: [],
    responder: null,
    closer: null,
  });
}

/** The rendered shop row for wood. Prices repeat across items, so a query for a
 * price has to be scoped to one row. */
function woodRow(): HTMLElement {
  const row = screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.startsWith(en["item.wood"]));
  if (!row) throw new Error("no wood row rendered");

  return row;
}

/** A slot array holding a single stack, for the panel's "held" column. */
function slotsHolding(itemId: ItemId, quantity: number): Array<InventorySlot | null> {
  const slots = new Array<InventorySlot | null>(20).fill(null);
  slots[0] = { itemId, quantity };
  return slots;
}

describe("shopStore", () => {
  beforeEach(resetShopStore);

  it("should start closed", () => {
    expect(useShopStore.getState().openNpcId).toBeNull();
    expect(isShopOpen()).toBe(false);
  });

  it("should mirror a snapshot and report the shop open", () => {
    useShopStore
      .getState()
      .setSnapshot({ openNpcId: "shopkeeper_juno", nameKey: "npc.juno.name" });

    expect(isShopOpen()).toBe(true);
    expect(useShopStore.getState().nameKey).toBe("npc.juno.name");

    useShopStore.getState().setSnapshot({ openNpcId: null, nameKey: null });
    expect(isShopOpen()).toBe(false);
  });

  it("should ignore trades before the game has injected its callbacks", () => {
    useShopStore.getState().trade("buy", "wood", 1);
    useShopStore.getState().open("shopkeeper_juno");
    useShopStore.getState().close();

    expect(useShopStore.getState().openNpcId).toBeNull();
  });
});

describe("ShopBridge", () => {
  beforeEach(resetShopStore);

  it("should write a requested trade onto the player's component", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const shop = playerEntity.getComponent<ShopComponent>("shop")!;
    wireShop(playerEntity);

    useShopStore.getState().trade("sell", "wood", 10);

    // React only ever raises a request; ShopSystem applies it (decision D13)
    expect(shop.requestedTrade).toEqual({
      kind: "sell",
      itemId: "wood",
      quantity: 10,
    });
    expect(shop.openNpcId).toBeNull();
  });

  it("should write the open and close requests onto the player's component", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const shop = playerEntity.getComponent<ShopComponent>("shop")!;
    wireShop(playerEntity);

    useShopStore.getState().open("shopkeeper_juno");
    expect(shop.requestedOpenNpcId).toBe("shopkeeper_juno");

    useShopStore.getState().close();
    expect(shop.closeRequested).toBe(true);
  });

  it("should stop writing once torn down", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const shop = playerEntity.getComponent<ShopComponent>("shop")!;

    wireShop(playerEntity)();
    useShopStore.getState().trade("buy", "wood", 1);

    expect(shop.requestedTrade).toBeNull();
    expect(useShopStore.getState().trader).toBeNull();
  });
});

describe("shop round trip", () => {
  beforeEach(() => {
    resetShopStore();
    resetDialogueStore();
  });

  it("should carry a purchase from the panel to the engine and back", () => {
    const context = createGameWorld(BOOTSTRAP);
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);
    wireShop(context.playerEntity);

    /** One frame of the real loop: simulate, publish, mirror. */
    const frame = () => {
      context.world.update(1 / 60);
      bridge.flush();
      const shopEvents = emitter.payloads<ShopChangedEvent>(SHOP_CHANGED_EVENT);
      if (shopEvents.length > 0) {
        useShopStore.getState().setSnapshot(shopEvents[shopEvents.length - 1]);
      }
      const walletEvents = emitter.payloads<WalletChangedEvent>(WALLET_CHANGED_EVENT);
      const latest = walletEvents[walletEvents.length - 1];
      if (latest) useGameStore.getState().setCoins(latest.coins);
    };

    useShopStore.getState().open("shopkeeper_juno");
    frame();

    expect(isShopOpen()).toBe(true);
    expect(useShopStore.getState().nameKey).toBe("npc.juno.name");
    expect(useGameStore.getState().coins).toBe(STARTING_COINS);

    useShopStore.getState().trade("buy", "wood", 2);
    frame();

    expect(useGameStore.getState().coins).toBe(STARTING_COINS - WOOD.buy * 2);

    useShopStore.getState().close();
    frame();

    expect(isShopOpen()).toBe(false);
  });
});

describe("HudBridge economy events", () => {
  it("should publish the coin balance once and then only on a change", () => {
    const context = createGameWorld(BOOTSTRAP);
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);

    bridge.flush();
    bridge.flush();

    expect(emitter.payloads<WalletChangedEvent>(WALLET_CHANGED_EVENT)).toEqual([
      { coins: STARTING_COINS },
    ]);
  });

  it("should publish nothing about a shop nobody opened", () => {
    const context = createGameWorld(BOOTSTRAP);
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);

    bridge.flush();

    expect(emitter.payloads<ShopChangedEvent>(SHOP_CHANGED_EVENT)).toHaveLength(0);
  });

  it("should publish once per accepted shop change", () => {
    const context = createGameWorld(BOOTSTRAP);
    const shop = context.playerEntity.getComponent<ShopComponent>("shop")!;
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);

    shop.requestedOpenNpcId = "shopkeeper_juno";
    context.world.update(1 / 60);
    bridge.flush();
    bridge.flush();

    expect(emitter.payloads<ShopChangedEvent>(SHOP_CHANGED_EVENT)).toEqual([
      { openNpcId: "shopkeeper_juno", nameKey: "npc.juno.name" },
    ]);
  });
});

describe("openShop dialogue action", () => {
  beforeEach(() => {
    resetShopStore();
    resetDialogueStore();
  });

  it("should open the shop and end the conversation instead of moving a node", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    const shop = playerEntity.getComponent<ShopComponent>("shop")!;
    wireDialogue(playerEntity);
    wireShop(playerEntity);

    useDialogueStore.getState().setSnapshot({
      npcId: "shopkeeper_juno",
      nameKey: "npc.juno.name",
      textKey: "dialogue.juno.greeting",
      options: [{ labelKey: "dialogue.juno.option.shop", action: { kind: "openShop" } }],
    });
    useDialogueStore.getState().respond(0);

    expect(shop.requestedOpenNpcId).toBe("shopkeeper_juno");
    expect(dialogue.closeRequested).toBe(true);
    expect(dialogue.requestedOption).toBeNull();
  });

  it("should still walk the graph for an option with no action", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    const shop = playerEntity.getComponent<ShopComponent>("shop")!;
    wireDialogue(playerEntity);
    wireShop(playerEntity);

    useDialogueStore.getState().setSnapshot({
      npcId: "shopkeeper_juno",
      nameKey: "npc.juno.name",
      textKey: "dialogue.juno.greeting",
      options: [{ labelKey: "dialogue.juno.option.prices", next: "prices" }],
    });
    useDialogueStore.getState().respond(0);

    expect(shop.requestedOpenNpcId).toBeNull();
    expect(dialogue.requestedOption).toBe(0);
  });
});

describe("Escape and the panel stack", () => {
  beforeEach(() => {
    resetShopStore();
    resetDialogueStore();
    useUIStore.setState({
      inventoryOpen: false,
      settingsOpen: false,
      buildMode: false,
    });
  });

  it("should report nothing to close on an empty HUD", () => {
    expect(closeTopmostPanel()).toBe(false);
    expect(isHudModal()).toBe(false);
  });

  it("should close the shop before any self-opened panel", () => {
    let closed = 0;
    useUIStore.getState().setInventoryOpen(true);
    useShopStore.getState().setSnapshot({
      openNpcId: "shopkeeper_juno",
      nameKey: "npc.juno.name",
    });
    useShopStore.getState().setCallbacks(null, null, () => {
      closed++;
    });

    expect(closeTopmostPanel()).toBe(true);
    expect(closed).toBe(1);
    // The inventory is still open: one press closes one thing
    expect(useUIStore.getState().inventoryOpen).toBe(true);
  });

  it("should close a conversation before the shop", () => {
    let dialogueClosed = 0;
    useDialogueStore.getState().setSnapshot({
      npcId: "villager_pip",
      nameKey: "npc.pip.name",
      textKey: "dialogue.pip.greeting",
      options: [],
    });
    useDialogueStore.getState().setCallbacks(null, () => {
      dialogueClosed++;
    });
    useShopStore.getState().setSnapshot({
      openNpcId: "shopkeeper_juno",
      nameKey: "npc.juno.name",
    });

    expect(closeTopmostPanel()).toBe(true);
    expect(dialogueClosed).toBe(1);
  });

  it("should leave build mode last, after every window", () => {
    useUIStore.setState({ settingsOpen: true, buildMode: true });

    expect(closeTopmostPanel()).toBe(true);
    expect(useUIStore.getState().settingsOpen).toBe(false);
    expect(useUIStore.getState().buildMode).toBe(true);

    expect(closeTopmostPanel()).toBe(true);
    expect(useUIStore.getState().buildMode).toBe(false);
  });

  it("should treat an open shop as the HUD owning the keyboard", () => {
    useShopStore.getState().setSnapshot({
      openNpcId: "shopkeeper_juno",
      nameKey: "npc.juno.name",
    });

    expect(isHudModal()).toBe(true);
  });
});

describe("ShopPanel", () => {
  beforeEach(() => {
    resetShopStore();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
    useGameStore.setState({
      coins: STARTING_COINS,
      inventorySlots: slotsHolding("wood", 3),
    });
  });

  afterEach(() => {
    cleanup();
    resetShopStore();
  });

  it("should render nothing while no shop is open", () => {
    const { container } = render(<ShopPanel />);

    expect(container.textContent).toBe("");
  });

  it("should render the shopkeeper's name, the balance and every priced item", () => {
    useShopStore
      .getState()
      .setSnapshot({ openNpcId: "shopkeeper_juno", nameKey: "npc.juno.name" });

    render(<ShopPanel />);

    expect(screen.getByText(en["npc.juno.name"])).toBeDefined();
    expect(screen.getByText(en["item.wood"], { exact: false })).toBeDefined();
    expect(screen.getByText(en["item.ore"], { exact: false })).toBeDefined();
    expect(screen.getAllByText(`${STARTING_COINS} coins`).length).toBeGreaterThan(0);
  });

  it("should call the injected trade with the row's item and quantity", () => {
    const trades: Array<[ShopTradeKind, ItemId, number]> = [];
    useShopStore
      .getState()
      .setSnapshot({ openNpcId: "shopkeeper_juno", nameKey: "npc.juno.name" });
    useShopStore
      .getState()
      .setCallbacks(
        (kind, itemId, quantity) => trades.push([kind, itemId, quantity]),
        null,
        null,
      );

    render(<ShopPanel />);
    const row = woodRow();
    fireEvent.click(within(row).getByTitle(`Costs ${WOOD.buy} coins`));
    fireEvent.click(within(row).getByTitle(`Pays ${WOOD.sell} coins`));

    expect(trades).toEqual([
      ["buy", "wood", 1],
      ["sell", "wood", 1],
    ]);
  });

  it("should disable a purchase the player cannot afford", () => {
    useGameStore.setState({ coins: 0 });
    useShopStore
      .getState()
      .setSnapshot({ openNpcId: "shopkeeper_juno", nameKey: "npc.juno.name" });

    render(<ShopPanel />);

    expect(
      within(woodRow()).getByTitle(`Costs ${WOOD.buy} coins`).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("should disable a sale of something the player does not hold enough of", () => {
    useShopStore
      .getState()
      .setSnapshot({ openNpcId: "shopkeeper_juno", nameKey: "npc.juno.name" });

    render(<ShopPanel />);
    const row = woodRow();

    // Three wood are held, so selling one is fine and selling ten is not
    expect(
      within(row).getByTitle(`Pays ${WOOD.sell} coins`).hasAttribute("disabled"),
    ).toBe(false);
    expect(
      within(row).getByTitle(`Pays ${WOOD.sell * 10} coins`).hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("CoinCounter", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
  });

  afterEach(cleanup);

  it("should show the mirrored balance", () => {
    useGameStore.setState({ coins: 123 });

    render(<CoinCounter />);

    expect(screen.getByText("123 coins")).toBeDefined();
  });
});
