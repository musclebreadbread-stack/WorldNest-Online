import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { FestivalComponent } from "../components/FestivalComponent";
import { WalletComponent } from "../components/WalletComponent";
import { getActiveFestival, claimFestivalReward } from "../festivals/festivalOps";
import { getFestival } from "../festivals/festivalDefinitions";

/** Callback that returns the current game day from the TimeComponent. */
export type DayGetter = () => number;

/**
 * FestivalSystem checks the world clock each frame and activates or
 * deactivates seasonal festivals on the FestivalComponent.
 *
 * It also handles reward claim requests raised by the HUD.
 *
 * Requires: festival, wallet, time.
 */
export class FestivalSystem extends System {
  private getDay: DayGetter;

  constructor(getDay: DayGetter = () => 1) {
    super(["festival", "wallet", "time"]);
    this.getDay = getDay;
  }

  update(entities: Entity[], _deltaTime: number): void {
    const day = this.getDay();

    for (const entity of entities) {
      const festival = entity.getComponent<FestivalComponent>("festival")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      // Determine active festival for today
      const activeDef = getActiveFestival(day);
      const activeId = activeDef?.id ?? null;

      // Update if the active festival changed
      if (festival.activeFestival !== activeId) {
        festival.activeFestival = activeId;
        festival.version += 1;
      }

      // Handle reward claim request
      if (festival.requestedClaim !== null) {
        const claimId = festival.requestedClaim;
        festival.requestedClaim = null;

        // Only allow claims for the currently active festival
        if (activeId === claimId) {
          const def = getFestival(claimId);
          if (def) {
            claimFestivalReward(festival, wallet, claimId, day, def.rewardCoins);
          }
        }
      }
    }
  }
}
