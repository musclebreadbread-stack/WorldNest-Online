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
import { GardeningComponent } from "../components/GardeningComponent";
import { ReputationComponent } from "../components/ReputationComponent";
import { ShopComponent } from "../components/ShopComponent";
import { TransportComponent } from "../components/TransportComponent";
import { WeatherGatheringComponent } from "../components/WeatherGatheringComponent";
import { WalletComponent } from "../components/WalletComponent";
import { countItem } from "../inventory/inventoryOps";
import { isCategoryComplete } from "../collection/collectionOps";
import {
  getHighestFriendshipLevel,
  getTotalGiftsGiven,
} from "../friendship/friendshipOps";
import { getMapCompletion } from "../exploration/explorationOps";
import {
  getTotalWeatherItemsGathered,
  getDistinctWeatherTypesGathered,
} from "../gathering/weatherGatheringOps";
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

      const source = this.buildSource(entity, inventory, collection, achievement);

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
    entity: Entity,
    inventory: InventoryComponent,
    collection: CollectionComponent,
    achievement: AchievementComponent,
  ): AchievementSource {
    const housingComp = entity.getComponent<HousingComponent>("housing");
    const transportComp = entity.getComponent<TransportComponent>("transport");
    if (transportComp?.mountState) {
      if (transportComp.mountState.bondLevel > achievement.highestMountBondLevel) {
        achievement.highestMountBondLevel = transportComp.mountState.bondLevel;
      }
    }
    if (this.pendingMountRides > 0 && achievement.highestMountBondLevel < 0) {
      achievement.highestMountBondLevel = 0;
    }
    if (
      transportComp &&
      transportComp.waterTilesTraversed > achievement.totalWaterTilesTraversed
    ) {
      achievement.totalWaterTilesTraversed = transportComp.waterTilesTraversed;
    }
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
    const explorationComp = entity.getComponent<ExplorationComponent>("exploration");
    const missionComp = entity.getComponent<MissionComponent>("mission");
    const shopComp = entity.getComponent<ShopComponent>("shop");
    const gardeningComp = entity.getComponent<GardeningComponent>("gardening");
    const weatherComp =
      entity.getComponent<WeatherGatheringComponent>("weatherGathering");
    const reputationComp = entity.getComponent<ReputationComponent>("reputation");
    return {
      itemCount: (id: string) => countItem(inventory, id as ItemId),
      donationCount: collection.discovered.size,
      structureCount: this.totalStructures(),
      questCompletionCount: achievement.totalQuestsCompleted,
      fishCaughtCount: achievement.totalFishCaught,
      totalCoinsEarned: achievement.totalCoinsEarned,
      animalsTamedCount: achievement.totalAnimalsTamed,
      quizStreak: this.currentQuizStreak,
      housingHappiness: housingComp ? housingComp.state.happiness : 0,
      craftCount: achievement.totalCraftsCompleted,
      rhythmPerfectCount: achievement.totalRhythmPerfects,
      rhythmScore: achievement.bestRhythmScore,
      mountBondLevel: achievement.highestMountBondLevel,
      waterTilesTraversed: achievement.totalWaterTilesTraversed,
      highestFriendshipLevel: achievement.highestFriendshipLevel,
      totalGiftsGiven: achievement.totalGiftsGiven,
      biomesDiscovered: explorationComp ? explorationComp.discoveredBiomes.size : 0,
      landmarksDiscovered: explorationComp
        ? explorationComp.discoveredLandmarks.size
        : 0,
      mapCompletionPercent: explorationComp ? getMapCompletion(explorationComp) : 0,
      missionsCompleted: missionComp ? missionComp.totalMissionsCompleted : 0,
      missionStreak: missionComp ? missionComp.dailyStreak : 0,
      rareItemsBought: shopComp ? shopComp.rareItemsPurchased : 0,
      shopsVisited: shopComp ? shopComp.shopsVisited.size : 0,
      gardenArrangements: gardeningComp ? gardeningComp.arrangements.length : 0,
      gardenCompetitionWins: gardeningComp
        ? gardeningComp.competitionHistory.length
        : 0,
      weatherItemsGathered: weatherComp ? getTotalWeatherItemsGathered(weatherComp) : 0,
      weatherTypesGathered: weatherComp
        ? getDistinctWeatherTypesGathered(weatherComp)
        : 0,
      villageTier: reputationComp ? reputationComp.currentTier : 0,
      contributionCount: reputationComp ? reputationComp.contributionHistory.length : 0,
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
