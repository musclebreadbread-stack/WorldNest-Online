import type { ItemId } from "@worldnest/shared";
import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { AchievementComponent } from "../components/AchievementComponent";
import { CollectionComponent } from "../components/CollectionComponent";
import { ExplorationComponent } from "../components/ExplorationComponent";
import { FriendshipComponent } from "../components/FriendshipComponent";
import { HousingComponent } from "../components/HousingComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { MissionComponent } from "../components/MissionComponent";
import { QuestComponent } from "../components/QuestComponent";
import { QuizComponent } from "../components/QuizComponent";
import { ReputationComponent } from "../components/ReputationComponent";
import { ShopComponent } from "../components/ShopComponent";
import { TransportComponent } from "../components/TransportComponent";
import { WalletComponent } from "../components/WalletComponent";
import { countItem } from "../inventory/inventoryOps";
import { isCategoryComplete } from "../collection/collectionOps";
import {
  getHighestFriendshipLevel,
  getTotalGiftsGiven,
} from "../friendship/friendshipOps";
import { getMapCompletion } from "../exploration/explorationOps";
import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementSource,
} from "../achievements/achievementDefinitions";
import { checkAchievement, unlockAchievement } from "../achievements/achievementOps";

/** How many structures of a kind stand in the world. Backed by `BuildSystem`. */
export type AchievementStructureCounter = (itemId: ItemId) => number;

/**
 * AchievementSystem polls achievement conditions each frame and unlocks badges
 * when conditions are met. On unlock it sets `pendingReward` on the component
 * and pays out the reward coins to the wallet.
 *
 * Requires: achievement, inventory, wallet, collection, quest.
 *
 * The system uses the same "polled progress" approach as QuestSystem: counters
 * are read from existing components each frame rather than relying on events.
 *
 * Lifetime counters are maintained as follows:
 * - `totalCoinsEarned`: delta detection on wallet.coins each frame
 * - `totalFishCaught`: incremented via `recordFishCaught()` listener
 * - `totalQuestsCompleted`: polled from QuestComponent.entries
 */
export class AchievementSystem extends System {
  private structureCount: AchievementStructureCounter;
  /** Fish caught since last update, reported by FishingSystem. */
  private pendingFishCaught = 0;
  /** Animals tamed since last update, reported by AnimalSystem. */
  private pendingAnimalsTamed = 0;
  /** Current quiz streak, updated by QuizSystem via listener. */
  private currentQuizStreak = 0;
  /** Crafts completed since last update, reported by CraftingSystem. */
  private pendingCraftsCompleted = 0;
  /** Mount rides since last update, reported by TransportSystem. */
  private pendingMountRides = 0;
  /** Rhythm perfects since last update, reported by MusicSystem. */
  private pendingRhythmPerfects = 0;
  /** Best rhythm score since last update, reported by MusicSystem. */
  private pendingBestRhythmScore = 0;

  constructor(structureCount: AchievementStructureCounter = () => 0) {
    super(["achievement", "inventory", "wallet", "collection", "quest"]);
    this.structureCount = structureCount;
  }

  /**
   * Note that the player caught a fish. Injected into `FishingSystem` as a
   * listener, matching the `QuestSystem.recordTalk` pattern.
   */
  recordFishCaught(): void {
    this.pendingFishCaught++;
  }

  /**
   * Note that the player tamed an animal. Injected into `AnimalSystem` as
   * a listener, matching the `recordFishCaught` pattern.
   */
  recordAnimalTamed(): void {
    this.pendingAnimalsTamed++;
  }

  /** Update quiz streak from QuizSystem listener. */
  recordQuizStreak(streak: number): void {
    this.currentQuizStreak = streak;
  }

  /** Note that the player completed a craft. */
  recordCraftCompleted(): void {
    this.pendingCraftsCompleted++;
  }

  /** Note that the player mounted a ride. */
  recordMountRide(): void {
    this.pendingMountRides++;
  }

  /** Record rhythm performance data from a completed song. */
  recordRhythmComplete(perfects: number, score: number): void {
    this.pendingRhythmPerfects += perfects;
    if (score > this.pendingBestRhythmScore) {
      this.pendingBestRhythmScore = score;
    }
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const achievement = entity.getComponent<AchievementComponent>("achievement")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;
      const collection = entity.getComponent<CollectionComponent>("collection")!;
      const quest = entity.getComponent<QuestComponent>("quest")!;

      // Read quiz streak directly from the QuizComponent when available.
      const quizComp = entity.getComponent<QuizComponent>("quiz");
      if (quizComp) {
        this.currentQuizStreak = quizComp.streak;
      }

      // Pay out any pending reward first
      if (achievement.pendingReward !== null) {
        const def = ACHIEVEMENT_DEFINITIONS.find(
          (d) => d.id === achievement.pendingReward,
        );
        if (def) {
          wallet.coins += def.rewardCoins;
        }
        achievement.pendingReward = null;
      }

      // --- Accumulator maintenance ---

      // totalCoinsEarned: detect wallet.coins increases from any source.
      // If coins went up, that delta is earnings. If coins went down, that
      // was a purchase (no change to totalCoinsEarned).
      if (wallet.coins > achievement.lastKnownCoins) {
        achievement.totalCoinsEarned += wallet.coins - achievement.lastKnownCoins;
      }
      achievement.lastKnownCoins = wallet.coins;

      // totalFishCaught: apply pending fish from the listener
      achievement.totalFishCaught += this.pendingFishCaught;

      // totalAnimalsTamed: apply pending tames from the listener
      achievement.totalAnimalsTamed += this.pendingAnimalsTamed;

      // totalCraftsCompleted: apply pending crafts from the listener
      achievement.totalCraftsCompleted += this.pendingCraftsCompleted;

      // totalRhythmPerfects: apply pending rhythm data from the listener
      achievement.totalRhythmPerfects += this.pendingRhythmPerfects;
      if (this.pendingBestRhythmScore > achievement.bestRhythmScore) {
        achievement.bestRhythmScore = this.pendingBestRhythmScore;
      }

      // totalQuestsCompleted: poll from quest entries (monotonic counter)
      const completedCount = Object.values(quest.entries).filter(
        (e) => e.state === "completed",
      ).length;
      achievement.totalQuestsCompleted = completedCount;

      // Build the polled source
      const housingComp = entity.getComponent<HousingComponent>("housing");
      const housingHappiness = housingComp ? housingComp.state.happiness : 0;
      const transportComp = entity.getComponent<TransportComponent>("transport");
      // Update mount bond tracking from transport component
      if (transportComp?.mountState) {
        if (transportComp.mountState.bondLevel > achievement.highestMountBondLevel) {
          achievement.highestMountBondLevel = transportComp.mountState.bondLevel;
        }
      }
      // Apply pending mount rides
      if (this.pendingMountRides > 0 && achievement.highestMountBondLevel < 0) {
        achievement.highestMountBondLevel = 0;
      }
      // Track water tiles traversed from transport component
      if (
        transportComp &&
        transportComp.waterTilesTraversed > achievement.totalWaterTilesTraversed
      ) {
        achievement.totalWaterTilesTraversed = transportComp.waterTilesTraversed;
      }
      // Track friendship progress
      const friendshipComp = entity.getComponent<FriendshipComponent>("friendship");
      if (friendshipComp) {
        const fLevel = getHighestFriendshipLevel(friendshipComp.entries);
        if (fLevel > achievement.highestFriendshipLevel) {
          achievement.highestFriendshipLevel = fLevel;
        }
        const fGifts = getTotalGiftsGiven(friendshipComp.entries);
        if (fGifts > achievement.totalGiftsGiven) {
          achievement.totalGiftsGiven = fGifts;
        }
      }
      // Track exploration progress
      const explorationComp = entity.getComponent<ExplorationComponent>("exploration");
      const biomesDiscovered = explorationComp
        ? explorationComp.discoveredBiomes.size
        : 0;
      const landmarksDiscovered = explorationComp
        ? explorationComp.discoveredLandmarks.size
        : 0;
      const mapCompletionPercent = explorationComp
        ? getMapCompletion(explorationComp)
        : 0;
      // Track mission progress
      const missionComp = entity.getComponent<MissionComponent>("mission");
      const missionsCompleted = missionComp ? missionComp.totalMissionsCompleted : 0;
      const missionStreak = missionComp ? missionComp.dailyStreak : 0;
      // Track shop expansion progress
      const shopComp = entity.getComponent<ShopComponent>("shop");
      const rareItemsBought = shopComp ? shopComp.rareItemsPurchased : 0;
      const shopsVisited = shopComp ? shopComp.shopsVisited.size : 0;
      // Track reputation progress
      const reputationComp = entity.getComponent<ReputationComponent>("reputation");
      const villageTier = reputationComp ? reputationComp.currentTier : 0;
      const contributionCount = reputationComp
        ? reputationComp.contributionHistory.length
        : 0;
      const source = this.buildSource(
        inventory,
        collection,
        wallet,
        achievement,
        housingHappiness,
        biomesDiscovered,
        landmarksDiscovered,
        mapCompletionPercent,
        missionsCompleted,
        missionStreak,
        rareItemsBought,
        shopsVisited,
        villageTier,
        contributionCount,
      );

      // Check each achievement that has not been unlocked yet
      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        if (checkAchievement(achievement, definition, source)) {
          unlockAchievement(achievement, definition.id);
          // Only unlock one per frame to avoid double-reward issues
          break;
        }
      }
    }

    // Cleared unconditionally: a catch nobody was there to hear is dropped
    // rather than queued forever.
    this.pendingFishCaught = 0;
    this.pendingAnimalsTamed = 0;
    this.pendingCraftsCompleted = 0;
    this.pendingMountRides = 0;
    this.pendingRhythmPerfects = 0;
    this.pendingBestRhythmScore = 0;
  }

  private buildSource(
    inventory: InventoryComponent,
    collection: CollectionComponent,
    _wallet: WalletComponent,
    achievement: AchievementComponent,
    housingHappiness: number,
    biomesDiscovered: number,
    landmarksDiscovered: number,
    mapCompletionPercent: number,
    missionsCompleted: number,
    missionStreak: number,
    rareItemsBought: number,
    shopsVisited: number,
    villageTier: number,
    contributionCount: number,
  ): AchievementSource {
    return {
      itemCount: (itemId: string) => countItem(inventory, itemId as ItemId),
      donationCount: collection.discovered.size,
      structureCount: this.totalStructures(),
      questCompletionCount: achievement.totalQuestsCompleted,
      fishCaughtCount: achievement.totalFishCaught,
      totalCoinsEarned: achievement.totalCoinsEarned,
      animalsTamedCount: achievement.totalAnimalsTamed,
      quizStreak: this.currentQuizStreak,
      housingHappiness,
      craftCount: achievement.totalCraftsCompleted,
      rhythmPerfectCount: achievement.totalRhythmPerfects,
      rhythmScore: achievement.bestRhythmScore,
      mountBondLevel: achievement.highestMountBondLevel,
      waterTilesTraversed: achievement.totalWaterTilesTraversed,
      highestFriendshipLevel: achievement.highestFriendshipLevel,
      totalGiftsGiven: achievement.totalGiftsGiven,
      biomesDiscovered,
      landmarksDiscovered,
      mapCompletionPercent,
      missionsCompleted,
      missionStreak,
      rareItemsBought,
      shopsVisited,
      gardenArrangements: 0,
      gardenCompetitionWins: 0,
      weatherItemsGathered: 0,
      weatherTypesGathered: 0,
      villageTier,
      contributionCount,
      isCategoryComplete: (categoryId: string) =>
        isCategoryComplete(collection, categoryId),
    };
  }

  private totalStructures(): number {
    let total = 0;
    const structureIds: ItemId[] = ["fence", "chest", "path_stone"];
    for (const id of structureIds) {
      total += this.structureCount(id);
    }
    return total;
  }
}
