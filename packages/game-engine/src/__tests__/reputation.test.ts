import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { ReputationComponent } from "../components/ReputationComponent";
import { WalletComponent } from "../components/WalletComponent";
import { VillageTier } from "../reputation/reputationDefinitions";
import {
  CONTRIBUTION_POINTS,
  TIER_MILESTONE_REWARDS,
  COMMUNITY_PROJECTS,
} from "../reputation/reputationDefinitions";
import {
  addContribution,
  getCurrentTier,
  getProgressToNextTier,
  checkTierUp,
  startCommunityProject,
  contributeToCommunityProject,
  completeCommunityProject,
  claimTierReward,
  getTierBenefits,
} from "../reputation/reputationOps";
import type { ReputationState } from "../reputation/reputationOps";
import { ReputationSystem } from "../systems/ReputationSystem";
import { checkCondition } from "../achievements/achievementOps";
import type { AchievementSource } from "../achievements/achievementDefinitions";

function createState(): ReputationState {
  return {
    totalPoints: 0,
    currentTier: VillageTier.HAMLET,
    contributionHistory: [],
    activeProjects: [],
    completedProjects: new Set(),
    tierRewardsClaimed: new Set(),
    version: 0,
  };
}

function createEntity() {
  const reputation = new ReputationComponent();
  const wallet = new WalletComponent(0);
  const entity = new Entity("player");
  entity.addComponent(reputation).addComponent(wallet);
  return { entity, reputation, wallet };
}

function makeSource(overrides: Partial<AchievementSource> = {}): AchievementSource {
  return {
    itemCount: () => 0,
    donationCount: 0,
    structureCount: 0,
    questCompletionCount: 0,
    fishCaughtCount: 0,
    totalCoinsEarned: 0,
    animalsTamedCount: 0,
    quizStreak: 0,
    housingHappiness: 0,
    craftCount: 0,
    rhythmPerfectCount: 0,
    rhythmScore: 0,
    mountBondLevel: -1,
    waterTilesTraversed: 0,
    highestFriendshipLevel: 0,
    totalGiftsGiven: 0,
    biomesDiscovered: 0,
    landmarksDiscovered: 0,
    mapCompletionPercent: 0,
    missionsCompleted: 0,
    missionStreak: 0,
    rareItemsBought: 0,
    shopsVisited: 0,
    gardenArrangements: 0,
    gardenCompetitionWins: 0,
    weatherItemsGathered: 0,
    weatherTypesGathered: 0,
    villageTier: 0,
    contributionCount: 0,
    isCategoryComplete: () => false,
    ...overrides,
  };
}

describe("reputationOps", () => {
  describe("addContribution", () => {
    it("adds points and records history", () => {
      const state = createState();
      const points = addContribution(state, "quest_complete");
      expect(points).toBe(CONTRIBUTION_POINTS.quest_complete);
      expect(state.totalPoints).toBe(10);
      expect(state.contributionHistory).toHaveLength(1);
      expect(state.contributionHistory[0]!.action).toBe("quest_complete");
      expect(state.version).toBe(1);
    });

    it("accumulates points from multiple actions", () => {
      const state = createState();
      addContribution(state, "quest_complete");
      addContribution(state, "donation");
      addContribution(state, "gift_given");
      expect(state.totalPoints).toBe(10 + 5 + 3);
      expect(state.contributionHistory).toHaveLength(3);
    });

    it("awards correct points per action type", () => {
      const state = createState();
      expect(addContribution(state, "quest_complete")).toBe(10);
      state.totalPoints = 0;
      state.contributionHistory = [];
      expect(addContribution(state, "donation")).toBe(5);
      state.totalPoints = 0;
      state.contributionHistory = [];
      expect(addContribution(state, "gift_given")).toBe(3);
      state.totalPoints = 0;
      state.contributionHistory = [];
      expect(addContribution(state, "structure_placed")).toBe(8);
      state.totalPoints = 0;
      state.contributionHistory = [];
      expect(addContribution(state, "competition_won")).toBe(15);
      state.totalPoints = 0;
      state.contributionHistory = [];
      expect(addContribution(state, "weather_item_gathered")).toBe(2);
    });
  });

  describe("getCurrentTier", () => {
    it("returns HAMLET for 0 points", () => {
      expect(getCurrentTier(0)).toBe(VillageTier.HAMLET);
    });

    it("returns VILLAGE at 100 points", () => {
      expect(getCurrentTier(100)).toBe(VillageTier.VILLAGE);
    });

    it("returns TOWN at 300 points", () => {
      expect(getCurrentTier(300)).toBe(VillageTier.TOWN);
    });

    it("returns CITY at 600 points", () => {
      expect(getCurrentTier(600)).toBe(VillageTier.CITY);
    });

    it("returns METROPOLIS at 1000 points", () => {
      expect(getCurrentTier(1000)).toBe(VillageTier.METROPOLIS);
    });

    it("returns correct tier for between-threshold values", () => {
      expect(getCurrentTier(99)).toBe(VillageTier.HAMLET);
      expect(getCurrentTier(150)).toBe(VillageTier.VILLAGE);
      expect(getCurrentTier(299)).toBe(VillageTier.VILLAGE);
      expect(getCurrentTier(500)).toBe(VillageTier.TOWN);
      expect(getCurrentTier(999)).toBe(VillageTier.CITY);
      expect(getCurrentTier(2000)).toBe(VillageTier.METROPOLIS);
    });
  });

  describe("getProgressToNextTier", () => {
    it("returns 0 at tier start", () => {
      const state = createState();
      expect(getProgressToNextTier(state)).toBe(0);
    });

    it("returns 50 at midpoint", () => {
      const state = createState();
      state.totalPoints = 50;
      expect(getProgressToNextTier(state)).toBe(50);
    });

    it("returns 100 at max tier", () => {
      const state = createState();
      state.currentTier = VillageTier.METROPOLIS;
      state.totalPoints = 1000;
      expect(getProgressToNextTier(state)).toBe(100);
    });
  });

  describe("checkTierUp", () => {
    it("returns new tier on upgrade", () => {
      const state = createState();
      state.totalPoints = 100;
      const result = checkTierUp(state);
      expect(result).toBe(VillageTier.VILLAGE);
      expect(state.currentTier).toBe(VillageTier.VILLAGE);
    });

    it("returns null when no upgrade", () => {
      const state = createState();
      state.totalPoints = 50;
      expect(checkTierUp(state)).toBeNull();
    });

    it("skips tiers if points exceed multiple thresholds", () => {
      const state = createState();
      state.totalPoints = 600;
      const result = checkTierUp(state);
      expect(result).toBe(VillageTier.CITY);
      expect(state.currentTier).toBe(VillageTier.CITY);
    });
  });

  describe("community projects", () => {
    it("starts a project when tier is met", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const project = COMMUNITY_PROJECTS[0]!;
      expect(startCommunityProject(state, project)).toBe(true);
      expect(state.activeProjects).toHaveLength(1);
    });

    it("rejects if tier not met", () => {
      const state = createState();
      const project = COMMUNITY_PROJECTS[0]!;
      expect(startCommunityProject(state, project)).toBe(false);
    });

    it("rejects duplicate start", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const project = COMMUNITY_PROJECTS[0]!;
      startCommunityProject(state, project);
      expect(startCommunityProject(state, project)).toBe(false);
    });

    it("contributes points to active project", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const project = COMMUNITY_PROJECTS[0]!;
      startCommunityProject(state, project);
      const contributed = contributeToCommunityProject(state, project.id, 30);
      expect(contributed).toBe(30);
      expect(state.activeProjects[0]!.contributedPoints).toBe(30);
    });

    it("caps contribution at required points", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const project = COMMUNITY_PROJECTS[0]!;
      startCommunityProject(state, project);
      const contributed = contributeToCommunityProject(state, project.id, 999);
      expect(contributed).toBe(project.requiredPoints);
    });

    it("completes project when points met", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const project = COMMUNITY_PROJECTS[0]!;
      startCommunityProject(state, project);
      contributeToCommunityProject(state, project.id, project.requiredPoints);
      expect(completeCommunityProject(state, project.id)).toBe(true);
      expect(state.completedProjects.has(project.id)).toBe(true);
      expect(state.activeProjects).toHaveLength(0);
    });

    it("rejects completion when points insufficient", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const project = COMMUNITY_PROJECTS[0]!;
      startCommunityProject(state, project);
      contributeToCommunityProject(state, project.id, 10);
      expect(completeCommunityProject(state, project.id)).toBe(false);
    });
  });

  describe("claimTierReward", () => {
    it("awards coins for reached tier", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      const reward = claimTierReward(state, VillageTier.VILLAGE);
      expect(reward).toBe(TIER_MILESTONE_REWARDS[VillageTier.VILLAGE]);
      expect(state.tierRewardsClaimed.has(VillageTier.VILLAGE)).toBe(true);
    });

    it("returns 0 if already claimed", () => {
      const state = createState();
      state.currentTier = VillageTier.VILLAGE;
      claimTierReward(state, VillageTier.VILLAGE);
      expect(claimTierReward(state, VillageTier.VILLAGE)).toBe(0);
    });

    it("returns 0 if tier not reached", () => {
      const state = createState();
      expect(claimTierReward(state, VillageTier.VILLAGE)).toBe(0);
    });
  });

  describe("getTierBenefits", () => {
    it("returns correct key for each tier", () => {
      expect(getTierBenefits(VillageTier.HAMLET)).toBe("reputation.benefits.hamlet");
      expect(getTierBenefits(VillageTier.METROPOLIS)).toBe(
        "reputation.benefits.metropolis",
      );
    });
  });
});

describe("ReputationSystem", () => {
  let system: ReputationSystem;

  beforeEach(() => {
    system = new ReputationSystem();
  });

  it("should require reputation and wallet", () => {
    expect(system.requiredComponents).toEqual(["reputation", "wallet"]);
  });

  it("should consume pending contribution", () => {
    const { entity, reputation } = createEntity();
    reputation.pendingContribution = { action: "quest_complete" };
    system.update([entity], 1 / 60);
    expect(reputation.pendingContribution).toBeNull();
    expect(reputation.totalPoints).toBe(10);
    expect(reputation.contributionHistory).toHaveLength(1);
  });

  it("should detect tier-up and award milestone coins", () => {
    const { entity, reputation, wallet } = createEntity();
    reputation.totalPoints = 90;
    reputation.pendingContribution = { action: "quest_complete" };
    system.update([entity], 1 / 60);
    expect(reputation.currentTier).toBe(VillageTier.VILLAGE);
    expect(wallet.coins).toBe(TIER_MILESTONE_REWARDS[VillageTier.VILLAGE]);
    expect(reputation.tierRewardsClaimed.has(VillageTier.VILLAGE)).toBe(true);
  });

  it("should not award coins without tier-up", () => {
    const { entity, reputation, wallet } = createEntity();
    reputation.pendingContribution = { action: "donation" };
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(0);
  });

  it("should do nothing when no pending contribution", () => {
    const { entity, reputation, wallet } = createEntity();
    system.update([entity], 1 / 60);
    expect(reputation.totalPoints).toBe(0);
    expect(wallet.coins).toBe(0);
  });

  it("should award multiple tier rewards on big tier jump", () => {
    const { entity, reputation, wallet } = createEntity();
    reputation.totalPoints = 290;
    reputation.pendingContribution = { action: "quest_complete" };
    system.update([entity], 1 / 60);
    // Should jump from HAMLET to TOWN (300 pts), claiming VILLAGE + TOWN
    expect(reputation.currentTier).toBe(VillageTier.TOWN);
    const expected =
      TIER_MILESTONE_REWARDS[VillageTier.VILLAGE] +
      TIER_MILESTONE_REWARDS[VillageTier.TOWN];
    expect(wallet.coins).toBe(expected);
  });
});

describe("Reputation achievements integration", () => {
  it("checks village_tier condition", () => {
    const source = makeSource({ villageTier: 1 });
    expect(checkCondition({ kind: "village_tier", tier: 1 }, source)).toBe(true);
    expect(checkCondition({ kind: "village_tier", tier: 2 }, source)).toBe(false);
  });

  it("checks contributions condition", () => {
    const source = makeSource({ contributionCount: 5 });
    expect(checkCondition({ kind: "contributions", count: 1 }, source)).toBe(true);
    expect(checkCondition({ kind: "contributions", count: 10 }, source)).toBe(false);
  });
});
