import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";

/**
 * Tracks which items a player has donated to the museum and which category
 * rewards they have claimed.
 *
 * Pure data by design: every mutation lives in `collection/collectionOps.ts`.
 * `version` is bumped by those operations so the UI layer can detect changes
 * without deep-comparing the sets every frame.
 */
export class CollectionComponent extends Component {
  /** Items the player has donated at least once. */
  public discovered: Set<ItemId>;
  /** Category ids whose completion reward has been claimed. */
  public categoryRewardsClaimed: Set<string>;
  /** The item the HUD asked to donate, consumed by `CollectionSystem`. */
  public requestedDonation: ItemId | null;
  /** Bumped by every accepted change. */
  public version: number;

  constructor() {
    super("collection");
    this.discovered = new Set();
    this.categoryRewardsClaimed = new Set();
    this.requestedDonation = null;
    this.version = 0;
  }
}
