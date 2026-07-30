import { create } from "zustand";
import type { ShopTradeKind } from "@worldnest/game-engine";
import type { ItemId } from "@worldnest/shared";
import type { ShopChangedEvent } from "../game/events";

/** Asks the engine for a trade. Injected by `ShopBridge` once the game boots. */
export type ShopTrader = (
  kind: ShopTradeKind,
  itemId: ItemId,
  quantity: number,
) => void;

/** Asks the engine to open a shop, and to close it again. */
export type ShopOpener = (npcId: string) => void;
export type ShopCloser = () => void;

interface ShopState {
  /** NPC whose shop is open, or `null` when the panel is closed. */
  openNpcId: string | null;
  /** i18n key of the shopkeeper's name, resolved by the panel. */
  nameKey: string | null;
  trader: ShopTrader | null;
  opener: ShopOpener | null;
  closer: ShopCloser | null;

  setSnapshot: (snapshot: ShopChangedEvent) => void;
  setCallbacks: (
    trader: ShopTrader | null,
    opener: ShopOpener | null,
    closer: ShopCloser | null,
  ) => void;
  trade: (kind: ShopTradeKind, itemId: ItemId, quantity: number) => void;
  open: (npcId: string) => void;
  close: () => void;
}

/**
 * The shop the HUD is showing, mirrored from the engine.
 *
 * Built exactly like `dialogueStore` (decision D13): every write is an injected
 * callback that raises a request flag on the player's `ShopComponent`, and
 * `ShopSystem` applies it on the next frame. React never moves a coin itself,
 * which is what stops a double-click from paying twice — the second click writes
 * over an unconsumed request rather than running the maths again.
 */
export const useShopStore = create<ShopState>((set, get) => ({
  openNpcId: null,
  nameKey: null,
  trader: null,
  opener: null,
  closer: null,

  setSnapshot: (snapshot) =>
    set({ openNpcId: snapshot.openNpcId, nameKey: snapshot.nameKey }),

  setCallbacks: (trader, opener, closer) => set({ trader, opener, closer }),

  // Wrapped rather than exposed raw so no caller has to null-check: before the
  // game has booted, trading is simply a no-op.
  trade: (kind, itemId, quantity) => get().trader?.(kind, itemId, quantity),

  open: (npcId) => get().opener?.(npcId),

  close: () => get().closer?.(),
}));

/** Whether a shop is open. Read by the Escape handler's panel precedence. */
export function isShopOpen(): boolean {
  return useShopStore.getState().openNpcId !== null;
}
