import { Component } from "../ecs/Component";

/**
 * An entity's coin purse.
 *
 * Coins are a single integer because that is all the economy needs (decision
 * D14: fixed NPC prices, no market), and they are persisted as one column on
 * `player_state` rather than a table of their own (decision D15).
 *
 * Pure data, like every component: the spending rules live in `shop/shopOps.ts`.
 */
export class WalletComponent extends Component {
  public coins: number;
  /**
   * A balance the server insists on, or `null` when nothing is pending.
   *
   * The client trades optimistically and the server reconciles (decision D4):
   * whatever the authority answered is written here by whoever is talking to it,
   * and `ShopSystem` — the wallet's owning system — is the only thing that ever
   * applies it. That keeps the async seam to a single request field, exactly
   * like the shop's own (decision D13).
   */
  public requestedBalance: number | null;
  /**
   * How many times the server disagreed with the local balance.
   *
   * A counter rather than a flag, for the same reason `ShopComponent.refusals`
   * is: the HUD can tell the player once per disagreement without polling, and a
   * reconciliation that changes nothing bumps nothing.
   */
  public adjustments: number;

  constructor(coins = 0) {
    super("wallet");
    this.coins = coins;
    this.requestedBalance = null;
    this.adjustments = 0;
  }
}
