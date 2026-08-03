/**
 * Pure functions for village reputation state management.
 *
 * Follows the ops-separate-from-system pattern. All functions are
 * side-effect-free and testable without an ECS world.
 */

import {
  CONTRIBUTION_POINTS,
  TIER_THRESHOLDS,
  TIER_MILESTONE_REWARDS,
  VillageTier,
  type ContributionAction,
  type CommunityProject,
} from "./reputationDefinitions";

/** A recorded contribution entry. */
export interface ContributionEntry {
  action: ContributionAction;
  points: number;
  timestamp: number;
}

/** Active community project progress tracker. */
export interface ActiveProject {
  projectId: string;
  contributedPoints: number;
  requiredPoints: number;
}

/** Minimal state shape the reputation ops need. */
export interface ReputationState {
  totalPoints: number;
  currentTier: VillageTier;
  contributionHistory: ContributionEntry[];
  activeProjects: ActiveProject[];
  completedProjects: Set<string>;
  tierRewardsClaimed: Set<VillageTier>;
  version: number;
}

/**
 * Record a contribution and update total points.
 * Returns the points awarded.
 */
export function addContribution(
  state: ReputationState,
  action: ContributionAction,
  timestamp = 0,
): number {
  const points = CONTRIBUTION_POINTS[action];
  state.totalPoints += points;
  state.contributionHistory.push({ action, points, timestamp });
  state.version++;
  return points;
}

/** Get the tier for a given point total. */
export function getCurrentTier(totalPoints: number): VillageTier {
  if (totalPoints >= TIER_THRESHOLDS[VillageTier.METROPOLIS]) {
    return VillageTier.METROPOLIS;
  }
  if (totalPoints >= TIER_THRESHOLDS[VillageTier.CITY]) {
    return VillageTier.CITY;
  }
  if (totalPoints >= TIER_THRESHOLDS[VillageTier.TOWN]) {
    return VillageTier.TOWN;
  }
  if (totalPoints >= TIER_THRESHOLDS[VillageTier.VILLAGE]) {
    return VillageTier.VILLAGE;
  }
  return VillageTier.HAMLET;
}

/**
 * Get the percentage progress to the next tier (0-100).
 * Returns 100 if already at the maximum tier.
 */
export function getProgressToNextTier(state: ReputationState): number {
  if (state.currentTier === VillageTier.METROPOLIS) return 100;
  const nextTier = (state.currentTier + 1) as VillageTier;
  const currentThreshold = TIER_THRESHOLDS[state.currentTier];
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const range = nextThreshold - currentThreshold;
  if (range <= 0) return 100;
  const progress = state.totalPoints - currentThreshold;
  return Math.min(100, Math.floor((progress / range) * 100));
}

/**
 * Check if the player has crossed into a new tier.
 * Returns the new tier if a tier-up occurred, null otherwise.
 */
export function checkTierUp(state: ReputationState): VillageTier | null {
  const calculatedTier = getCurrentTier(state.totalPoints);
  if (calculatedTier > state.currentTier) {
    state.currentTier = calculatedTier;
    state.version++;
    return calculatedTier;
  }
  return null;
}

/**
 * Start a community project. Returns true if the project was started.
 * Returns false if already active, already completed, or tier not met.
 */
export function startCommunityProject(
  state: ReputationState,
  project: CommunityProject,
): boolean {
  if (state.completedProjects.has(project.id)) return false;
  if (state.activeProjects.some((p) => p.projectId === project.id)) {
    return false;
  }
  if (state.currentTier < project.requiredTier) return false;
  state.activeProjects.push({
    projectId: project.id,
    contributedPoints: 0,
    requiredPoints: project.requiredPoints,
  });
  state.version++;
  return true;
}

/**
 * Contribute points to an active community project.
 * Returns the points actually contributed (0 if project not found/complete).
 */
export function contributeToCommunityProject(
  state: ReputationState,
  projectId: string,
  points: number,
): number {
  const active = state.activeProjects.find((p) => p.projectId === projectId);
  if (!active) return 0;
  const remaining = active.requiredPoints - active.contributedPoints;
  const contributed = Math.min(points, remaining);
  active.contributedPoints += contributed;
  state.version++;
  return contributed;
}

/**
 * Complete a community project if it has reached its required points.
 * Returns true if the project was completed.
 */
export function completeCommunityProject(
  state: ReputationState,
  projectId: string,
): boolean {
  const idx = state.activeProjects.findIndex((p) => p.projectId === projectId);
  if (idx === -1) return false;
  const project = state.activeProjects[idx]!;
  if (project.contributedPoints < project.requiredPoints) return false;
  state.activeProjects.splice(idx, 1);
  state.completedProjects.add(projectId);
  state.version++;
  return true;
}

/**
 * Claim the milestone reward for a tier.
 * Returns the coins awarded, or 0 if already claimed.
 */
export function claimTierReward(state: ReputationState, tier: VillageTier): number {
  if (state.tierRewardsClaimed.has(tier)) return 0;
  if (state.currentTier < tier) return 0;
  state.tierRewardsClaimed.add(tier);
  state.version++;
  return TIER_MILESTONE_REWARDS[tier];
}

/**
 * Get the benefits/unlocks description key for the current tier.
 */
export function getTierBenefits(tier: VillageTier): string {
  const keys: Record<VillageTier, string> = {
    [VillageTier.HAMLET]: "reputation.benefits.hamlet",
    [VillageTier.VILLAGE]: "reputation.benefits.village",
    [VillageTier.TOWN]: "reputation.benefits.town",
    [VillageTier.CITY]: "reputation.benefits.city",
    [VillageTier.METROPOLIS]: "reputation.benefits.metropolis",
  };
  return keys[tier];
}
