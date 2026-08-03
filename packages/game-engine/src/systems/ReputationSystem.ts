import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { ReputationComponent } from "../components/ReputationComponent";
import { WalletComponent } from "../components/WalletComponent";
import {
  addContribution,
  checkTierUp,
  claimTierReward,
} from "../reputation/reputationOps";
import { VillageTier } from "../reputation/reputationDefinitions";

/**
 * ReputationSystem consumes pending contributions, checks for tier-ups,
 * and awards milestone coin rewards.
 *
 * Requires: reputation, wallet.
 */
export class ReputationSystem extends System {
  constructor() {
    super(["reputation", "wallet"]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const reputation = entity.getComponent<ReputationComponent>("reputation")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      // Consume pending contribution request
      if (reputation.pendingContribution !== null) {
        addContribution(reputation, reputation.pendingContribution.action);
        reputation.pendingContribution = null;

        // Check for tier-up after contribution
        const newTier = checkTierUp(reputation);
        if (newTier !== null) {
          this.awardMilestone(reputation, wallet, newTier);
        }
      }
    }
  }

  private awardMilestone(
    reputation: ReputationComponent,
    wallet: WalletComponent,
    tier: VillageTier,
  ): void {
    // Award all unclaimed milestone rewards up to the new tier
    const tiers = [
      VillageTier.VILLAGE,
      VillageTier.TOWN,
      VillageTier.CITY,
      VillageTier.METROPOLIS,
    ];
    for (const t of tiers) {
      if (t > tier) break;
      const reward = claimTierReward(reputation, t);
      if (reward > 0) {
        wallet.coins += reward;
      }
    }
  }
}
