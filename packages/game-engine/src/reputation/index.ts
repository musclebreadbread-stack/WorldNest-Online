export {
  VillageTier,
  TIER_THRESHOLDS,
  CONTRIBUTION_POINTS,
  TIER_NAME_KEYS,
  TIER_MILESTONE_REWARDS,
  COMMUNITY_PROJECTS,
  COMMUNITY_PROJECT_IDS,
  getCommunityProject,
} from "./reputationDefinitions";
export type { ContributionAction, CommunityProject } from "./reputationDefinitions";

export {
  addContribution,
  getCurrentTier,
  getProgressToNextTier,
  checkTierUp,
  startCommunityProject,
  contributeToCommunityProject,
  completeCommunityProject,
  claimTierReward,
  getTierBenefits,
} from "./reputationOps";
export type {
  ContributionEntry,
  ActiveProject,
  ReputationState,
} from "./reputationOps";
