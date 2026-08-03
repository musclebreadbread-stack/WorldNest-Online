export {
  FRIENDSHIP_THRESHOLDS,
  GIFT_BASE_POINTS,
  GIFT_BOX_BONUS,
  GIFT_MULTIPLIERS,
  LEVEL_REWARDS,
  MAX_DAILY_GIFTS,
  NPC_GIFT_PREFERENCES,
} from "./friendshipDefinitions";
export type {
  FriendshipLevel,
  GiftPreference,
  GiftReaction,
} from "./friendshipDefinitions";
export type { FriendshipEntry } from "./friendshipState";
export {
  canGiveGift,
  getGiftReaction,
  getFriendshipLevel,
  getHighestFriendshipLevel,
  getLevelReward,
  getTotalGiftsGiven,
  giveGift,
  resetDailyGifts,
} from "./friendshipOps";
export type { GiftResult } from "./friendshipOps";
