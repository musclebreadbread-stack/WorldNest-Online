import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { MissionComponent } from "../components/MissionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { countItem } from "../inventory/inventoryOps";
import { getMission } from "../missions/missionDefinitions";
import {
  claimMissionReward,
  completeMission,
  recordMissionProgress,
  refreshDailyMissions,
  refreshWeeklyMissions,
} from "../missions/missionOps";

/** Callback that returns the current game day. */
export type MissionDayGetter = () => number;

/** Callback that returns the current game week. */
export type MissionWeekGetter = () => number;

/**
 * MissionSystem manages daily/weekly mission lifecycle: refresh on day/week
 * boundaries, poll progress for active missions, and consume claim requests.
 *
 * Requires: mission, inventory, wallet.
 */
export class MissionSystem extends System {
  private getDay: MissionDayGetter;
  private getWeek: MissionWeekGetter;

  /** Accumulated fish caught via listener. */
  // NOTE: Pending event counters are accumulated at the system level and applied
  // to every entity in the update loop. This is correct for single-player (one
  // player entity), but would need per-entity tracking for multiplayer support.
  private pendingFishCaught = 0;
  /** Accumulated donations via listener. */
  private pendingDonations = 0;
  /** Accumulated cooked dishes via listener. */
  private pendingCooks = 0;
  /** Accumulated tiles explored via listener. */
  private pendingTilesExplored = 0;
  /** Accumulated NPC talks via listener. */
  private pendingTalks = 0;

  constructor(
    getDay: MissionDayGetter = () => 1,
    getWeek: MissionWeekGetter = () => 0,
  ) {
    super(["mission", "inventory", "wallet"]);
    this.getDay = getDay;
    this.getWeek = getWeek;
  }

  /** Called by FishingSystem when a fish is caught. */
  recordFishCaught(): void {
    this.pendingFishCaught++;
  }

  /** Called by CollectionSystem when a donation is made. */
  recordDonation(): void {
    this.pendingDonations++;
  }

  /** Called by CookingSystem when a dish is completed. */
  recordCookCompleted(): void {
    this.pendingCooks++;
  }

  /** Called by ExplorationSystem when tiles are explored. */
  recordTilesExplored(count: number): void {
    this.pendingTilesExplored += count;
  }

  /** Called by NpcSystem when an NPC is talked to. */
  recordNpcTalk(): void {
    this.pendingTalks++;
  }

  update(entities: Entity[], _deltaTime: number): void {
    const day = this.getDay();
    const week = this.getWeek();

    for (const entity of entities) {
      const mission = entity.getComponent<MissionComponent>("mission")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      // Refresh on day/week boundaries
      refreshDailyMissions(mission, day);
      refreshWeeklyMissions(mission, week);

      // Poll progress for each active mission
      for (const entry of Object.values(mission.activeMissions)) {
        if (entry.completed) continue;

        const def = getMission(entry.missionId);
        if (!def) continue;

        const objective = def.objective;
        let currentProgress = 0;

        switch (objective.kind) {
          case "collect":
            currentProgress = countItem(inventory, objective.itemId);
            break;
          case "fish":
            currentProgress = entry.progress + this.pendingFishCaught;
            break;
          case "donate":
            currentProgress = entry.progress + this.pendingDonations;
            break;
          case "cook":
            currentProgress = entry.progress + this.pendingCooks;
            break;
          case "explore_tiles":
            currentProgress = entry.progress + this.pendingTilesExplored;
            break;
          case "talk_npc":
            currentProgress = entry.progress + this.pendingTalks;
            break;
        }

        // For collect objectives, set progress directly from inventory
        if (objective.kind === "collect") {
          const delta = currentProgress - entry.progress;
          if (delta > 0) {
            recordMissionProgress(mission, entry.missionId, delta);
          }
        } else {
          // For event-based objectives, delta is what was accumulated
          const delta = currentProgress - entry.progress;
          if (delta > 0) {
            recordMissionProgress(mission, entry.missionId, delta);
          }
        }

        // Auto-complete when progress reaches target
        if (!entry.completed && entry.progress >= objective.count) {
          completeMission(mission, entry.missionId, day);
        }
      }

      // Handle claim request from HUD
      if (mission.requestedClaim !== null) {
        const claimId = mission.requestedClaim;
        mission.requestedClaim = null;
        claimMissionReward(mission, claimId, wallet);
      }
    }

    // Clear pending counters after processing all entities
    this.pendingFishCaught = 0;
    this.pendingDonations = 0;
    this.pendingCooks = 0;
    this.pendingTilesExplored = 0;
    this.pendingTalks = 0;
  }
}
