import { Component } from "../ecs/Component";
import { VillageTier } from "../reputation/reputationDefinitions";
import type { ContributionAction } from "../reputation/reputationDefinitions";
import type { ContributionEntry, ActiveProject } from "../reputation/reputationOps";

/**
 * Tracks a player's village reputation: contribution points, tier,
 * community projects, and reward state.
 *
 * Pure data. The logic lives in `reputation/reputationOps.ts` and the
 * system in `ReputationSystem`.
 */
export class ReputationComponent extends Component {
  /** Total reputation points accumulated. */
  public totalPoints: number;
  /** Current village development tier. */
  public currentTier: VillageTier;
  /** History of contributions made by this player. */
  public contributionHistory: ContributionEntry[];
  /** Currently active community projects. */
  public activeProjects: ActiveProject[];
  /** Ids of completed community projects. */
  public completedProjects: Set<string>;
  /** Tiers whose milestone rewards have been claimed. */
  public tierRewardsClaimed: Set<VillageTier>;
  /** Monotonically increasing version for change detection. */
  public version: number;
  /** Pending contribution request (set externally, consumed by system). */
  public pendingContribution: {
    action: ContributionAction;
    amount?: number;
  } | null;

  constructor() {
    super("reputation");
    this.totalPoints = 0;
    this.currentTier = VillageTier.HAMLET;
    this.contributionHistory = [];
    this.activeProjects = [];
    this.completedProjects = new Set();
    this.tierRewardsClaimed = new Set();
    this.version = 0;
    this.pendingContribution = null;
  }
}
