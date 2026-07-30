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

  constructor(coins = 0) {
    super("wallet");
    this.coins = coins;
  }
}
