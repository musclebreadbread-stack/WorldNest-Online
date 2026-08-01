import { Component } from "../ecs/Component";
import type { FriendshipEntry } from "../friendship/friendshipState";
import type { ItemId } from "@worldnest/shared";

/**
 * Friendship state for an entity.
 *
 * Tracks friendship entries for all NPCs, any pending gift request,
 * and the last day that daily counters were reset. Pure data by design:
 * all transitions live in `friendshipOps.ts` and `FriendshipSystem.ts`.
 */
export class FriendshipComponent extends Component {
  /** Friendship entries keyed by NPC id. */
  public entries: Record<string, FriendshipEntry>;
  /** Pending gift request (system consumes this each frame). */
  public requestGift: { npcId: string; itemId: ItemId } | null;
  /** Last in-game day that daily gifts were reset. */
  public lastResetDay: number;
  /** Bumped on every state change. */
  public version: number;

  constructor() {
    super("friendship");
    this.entries = {};
    this.requestGift = null;
    this.lastResetDay = 0;
    this.version = 0;
  }
}
