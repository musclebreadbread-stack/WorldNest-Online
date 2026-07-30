import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";

/** Which way a trade goes, from the player's point of view. */
export type ShopTradeKind = "buy" | "sell";

/** One requested transaction. Quantity is validated when it is consumed. */
export interface ShopTrade {
  kind: ShopTradeKind;
  itemId: ItemId;
  quantity: number;
}

/**
 * The shop an entity has open, plus the three request fields React writes
 * through its injected callbacks (decision D13).
 *
 * Shaped exactly like `DialogueComponent`: the HUD only ever *asks*
 * (`requestedOpenNpcId`, `closeRequested`, `requestedTrade`) and `ShopSystem` is
 * the only thing that changes `openNpcId` or a wallet. That is what stops a
 * mis-timed click from spending coins twice, and it means the panel can be a
 * plain mirror of `version`.
 */
export class ShopComponent extends Component {
  /** NPC whose shop is open, or `null` when the panel is closed. */
  public openNpcId: string | null;
  /** Shop the HUD asked to open, usually from a dialogue option. */
  public requestedOpenNpcId: string | null;
  public closeRequested: boolean;
  /** Trade the HUD asked for, or `null` when nothing is pending. */
  public requestedTrade: ShopTrade | null;
  /**
   * Trades the shop turned down. Bumped instead of `version` so the HUD can tell
   * "nothing happened, and it was not going to" from a successful purchase — it
   * is what the refusal sound is played from.
   */
  public refusals: number;
  /** Bumped by every accepted change, so the HUD can publish without diffing. */
  public version: number;

  constructor() {
    super("shop");
    this.openNpcId = null;
    this.requestedOpenNpcId = null;
    this.closeRequested = false;
    this.requestedTrade = null;
    this.refusals = 0;
    this.version = 0;
  }
}
