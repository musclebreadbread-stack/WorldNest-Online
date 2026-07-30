import { tradeValue, type ItemId } from "@worldnest/shared";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { ShopTrade, ShopTradeKind } from "../components/ShopComponent";
import { addItem, countItem, hasSpaceFor, removeItem } from "../inventory/inventoryOps";

/**
 * The shop's rules, as pure functions over plain data.
 *
 * `WalletComponent` satisfies `Wallet` structurally, so every rule below is
 * testable without an ECS world — the same split `inventoryOps` and `dialogueOps`
 * use. Each function returns a boolean and is **all or nothing**: a refused trade
 * leaves both the inventory and the purse exactly as they were, which is what
 * stops a full backpack from swallowing coins.
 */
export interface Wallet {
  coins: number;
}

/** Coins a trade would move, or `null` when the shop will not make it. */
export function tradeQuote(
  kind: ShopTradeKind,
  itemId: ItemId,
  quantity: number,
): number | null {
  return tradeValue(kind, itemId, quantity);
}

/**
 * Buy items from the shop.
 *
 * The space check comes before the payment for the same reason `HarvestSystem`
 * checks it before clearing a tile: taking the coins and then dropping the goods
 * on the floor is the one outcome a player would never forgive.
 */
export function buy(
  inventory: InventoryComponent,
  wallet: Wallet,
  itemId: ItemId,
  quantity: number,
): boolean {
  const cost = tradeQuote("buy", itemId, quantity);
  if (cost === null) return false;
  if (wallet.coins < cost) return false;
  if (!hasSpaceFor(inventory, itemId, quantity)) return false;

  wallet.coins -= cost;
  addItem(inventory, itemId, quantity);
  return true;
}

/** Sell items to the shop. Refused unless the whole quantity is actually held. */
export function sell(
  inventory: InventoryComponent,
  wallet: Wallet,
  itemId: ItemId,
  quantity: number,
): boolean {
  const payout = tradeQuote("sell", itemId, quantity);
  if (payout === null) return false;
  if (countItem(inventory, itemId) < quantity) return false;

  removeItem(inventory, itemId, quantity);
  wallet.coins += payout;
  return true;
}

/** Apply a requested trade in whichever direction it points. */
export function applyTrade(
  inventory: InventoryComponent,
  wallet: Wallet,
  trade: ShopTrade,
): boolean {
  return trade.kind === "buy"
    ? buy(inventory, wallet, trade.itemId, trade.quantity)
    : sell(inventory, wallet, trade.itemId, trade.quantity);
}

/**
 * Whether a trade could be made right now. Shared with the shop panel so a
 * disabled button and a refused request can never disagree.
 */
export function canTrade(
  inventory: InventoryComponent,
  wallet: Wallet,
  trade: ShopTrade,
): boolean {
  const quote = tradeQuote(trade.kind, trade.itemId, trade.quantity);
  if (quote === null) return false;

  return trade.kind === "buy"
    ? wallet.coins >= quote && hasSpaceFor(inventory, trade.itemId, trade.quantity)
    : countItem(inventory, trade.itemId) >= trade.quantity;
}
