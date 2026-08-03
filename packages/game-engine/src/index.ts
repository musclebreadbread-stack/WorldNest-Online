// ECS Core
export { World } from "./ecs/World";
export { Entity } from "./ecs/Entity";
export type { EntityChangeListener } from "./ecs/Entity";
export { Component } from "./ecs/Component";
export { System } from "./ecs/System";
export type { AddEntity, RemoveEntityById } from "./ecs/World";

// Components
export {
  PositionComponent,
  VelocityComponent,
  SpriteComponent,
  PlayerComponent,
  ChunkComponent,
  InputComponent,
  NetworkComponent,
  RemoteInterpolationComponent,
  ColliderComponent,
  TimeComponent,
  EnvironmentComponent,
  InventoryComponent,
  StatsComponent,
  InteractionComponent,
  CropComponent,
  DialogueComponent,
  NpcComponent,
  QuestComponent,
  ShopComponent,
  WalletComponent,
  StructureComponent,
  AnimationComponent,
  DEFAULT_FRAME_DURATION_MS,
  DEFAULT_FRAME_COUNT,
  FishingComponent,
  CollectionComponent,
  AchievementComponent,
  CookingComponent,
  FestivalComponent,
  AnimalComponent,
  QuizComponent,
  AccessibilityComponent,
  HousingComponent,
  CraftingComponent,
  MusicComponent,
  TransportComponent,
  FriendshipComponent,
  ExplorationComponent,
  MissionComponent,
  GardeningComponent,
  WeatherGatheringComponent,
  ReputationComponent,
} from "./components";
export type {
  KeyState,
  InventorySlot,
  AnimationState,
  QuestEntry,
  QuestState,
  ShopTrade,
  ShopTradeKind,
  PlaceRequest,
  RemoveRequest,
} from "./components";

// Inventory operations (pure functions; components stay pure data)
export {
  addItem,
  removeItem,
  countItem,
  hasSpaceFor,
  getSelectedItem,
  selectSlot,
  moveSlot,
} from "./inventory";

// Fishing (pure; definitions and state-machine ops)
export {
  BIOME_FISH_TABLE,
  FISHING_BITE_MAX_MS,
  FISHING_BITE_MIN_MS,
  FISHING_ENERGY_COST,
  FISHING_WINDOW_MS,
  canFish,
  randomBiteTime,
  reelIn,
  rollCatch,
  tickFishing,
} from "./fishing";
export type { FishCatch, FishingState } from "./fishing";

// Cooking (pure; recipe system and food consumption)
export {
  FOOD_ENERGY,
  RECIPE_DEFINITIONS,
  RECIPE_IDS,
  canCook,
  completeCooking,
  consumeFood,
  getRecipe,
  startCooking,
  tickCooking,
} from "./cooking";
export type { CookingState, RecipeDefinition, RecipeIngredient } from "./cooking";

// Crafting (pure; workbench recipes, tool bonuses, resource refinement)
export {
  CRAFTING_RECIPES,
  CRAFTING_RECIPE_IDS,
  TOOL_TIER_BONUS,
  canCraft,
  completeCraft,
  getAvailableRecipes,
  getCraftingRecipe,
  getToolBonus,
  startCraft,
  tickCraft,
} from "./crafting";
export type {
  CraftingIngredient,
  CraftingRecipe,
  CraftingStation,
  CraftingState as CraftingMachineState,
  ToolBonus,
  ToolTier,
} from "./crafting";

// Music (pure; rhythm mini-game, timing windows, composition)
export {
  NOTE_TIMING_GOOD_MS,
  NOTE_TIMING_PERFECT_MS,
  SCORE_GOOD,
  SCORE_PERFECT,
  SONG_COMPLETE_COINS,
  INSTRUMENT_DEFINITIONS,
  SONG_DEFINITIONS,
  getSong,
  canStartRhythm,
  startSong,
  tickRhythm,
  hitNote,
  completeSong,
  composeMelody,
  getComboMultiplier,
  COMPOSE_MIN_NOTES,
  COMPOSE_MAX_NOTES,
} from "./music";
export type {
  InstrumentType,
  RhythmNote,
  SongDefinition,
  InstrumentDefinition,
  MusicState,
  RhythmResult,
  PerformanceScore,
  StartSongResult,
  TickRhythmResult,
} from "./music";

// Transport (pure; mounts, boats, stamina, speed multipliers)
export {
  BOAT_SPEED_MULTIPLIER,
  MOUNT_DEFINITIONS,
  MOUNT_FEED_RESTORE,
  MOUNT_SPECIES,
  MOUNT_STAMINA_DRAIN_PER_SECOND,
  boatCanTraverse,
  calculateSpeed,
  canBoard,
  canMount,
  dismount,
  feedMount,
  getMountBondLevel,
  isMountExhausted,
  mount as mountTransport,
  tickMountStamina,
} from "./transport";
export type {
  MountDefinition,
  MountSpecies,
  MountState,
  TransportMode,
} from "./transport";

// Friendship (pure; NPC gift giving, levels, daily limits)
export {
  FRIENDSHIP_THRESHOLDS,
  GIFT_BASE_POINTS,
  GIFT_MULTIPLIERS,
  LEVEL_REWARDS,
  MAX_DAILY_GIFTS,
  NPC_GIFT_PREFERENCES,
  canGiveGift,
  getGiftReaction,
  getFriendshipLevel,
  getHighestFriendshipLevel,
  getLevelReward,
  getTotalGiftsGiven,
  giveGift,
  resetDailyGifts,
} from "./friendship";
export type {
  FriendshipEntry,
  FriendshipLevel,
  GiftPreference,
  GiftReaction,
  GiftResult,
} from "./friendship";

// Exploration (pure; biome discovery, landmarks, map completion)
export {
  BIOME_DISCOVERY_REWARDS,
  LANDMARK_DEFINITIONS,
  LANDMARK_IDS,
  discoverBiome,
  discoverLandmark,
  getExplorationReward,
  getLandmark,
  getMapCompletion,
  getNextMilestoneKey,
  recordTilesExplored,
} from "./exploration";
export type { ExplorationState, LandmarkDefinition } from "./exploration";

// Gardening (pure; flower arrangements, competitions, garden plots)
export {
  ARRANGEMENT_FLOWER_COUNT,
  COMPETITION_REWARDS,
  COMPETITION_THRESHOLDS,
  CompetitionTier,
  FLOWER_BEAUTY_POINTS,
  FLOWER_GROWTH_TIME_MS,
  FLOWER_VARIETIES,
  FlowerVariety,
  MAX_WATER_LEVEL,
  SEASONAL_BONUS_MULTIPLIER,
  VARIETY_BONUS_MULTIPLIER,
  WATER_PER_ACTION,
  createArrangement,
  enterCompetition,
  harvestFlower,
  judgeCompetition,
  plantFlower,
  scoreArrangement,
  waterGarden,
} from "./gardening";
export type {
  Arrangement,
  CompetitionEntry,
  GardenPlot,
  GardeningState,
} from "./gardening";

// Gathering (pure; weather-enhanced collectibles and availability)
export {
  WEATHER_EXCLUSIVE_ITEM_IDS,
  WEATHER_GATHER_CHANCE,
  WEATHER_GATHER_COOLDOWN_MS,
  WEATHER_GATHER_ITEMS,
  WEATHER_GATHER_TABLE,
  calculateWeatherItemValue,
  canGatherWeatherItem,
  getAvailableWeatherItems,
  getDistinctWeatherTypesGathered,
  getTotalWeatherItemsGathered,
  pushWeatherNotification,
  recordWeatherGather,
  rollWeatherGather,
} from "./gathering";
export type {
  WeatherGatherItem,
  WeatherGatheringState,
  WeatherNotification,
} from "./gathering";

// Reputation (pure; village development tiers, community projects)
export {
  VillageTier,
  TIER_THRESHOLDS,
  CONTRIBUTION_POINTS,
  TIER_NAME_KEYS,
  TIER_MILESTONE_REWARDS,
  COMMUNITY_PROJECTS,
  COMMUNITY_PROJECT_IDS,
  getCommunityProject,
  addContribution,
  getCurrentTier,
  getProgressToNextTier,
  checkTierUp,
  startCommunityProject,
  contributeToCommunityProject,
  completeCommunityProject,
  claimTierReward,
  getTierBenefits,
} from "./reputation";
export type {
  ContributionAction,
  CommunityProject,
  ContributionEntry,
  ActiveProject,
  ReputationState,
} from "./reputation";

// Missions (pure; daily/weekly rotating objectives with streak bonuses)
export {
  DAILY_MISSIONS,
  WEEKLY_MISSIONS,
  STREAK_BONUS_MULTIPLIERS,
  getDailyMissionForDay,
  getMission,
  getWeeklyMissionForWeek,
  claimMissionReward,
  completeMission,
  getActiveMissions,
  getStreakMultiplier,
  recordMissionProgress,
  refreshDailyMissions,
  refreshWeeklyMissions,
} from "./missions";
export type {
  MissionDefinition,
  MissionEntry,
  MissionObjective,
  MissionState,
  MissionTier,
} from "./missions";

// Festivals (pure; seasonal timed world events)
export {
  FESTIVAL_DEFINITIONS,
  FESTIVAL_IDS,
  claimFestivalReward,
  dayOfSeason,
  getActiveFestival,
  getCycleKey,
  getCycleNumber,
  getFestival,
  getFestivalProgress,
  isFestivalActive,
} from "./festivals";
export type { FestivalDefinition } from "./festivals";

// Animals (pure; species catalogue, behavior ops, taming logic)
export {
  ANIMAL_DEFINITIONS,
  ANIMAL_SPECIES,
  FOLLOW_STOP_DISTANCE,
  IDLE_WANDER_INTERVAL_MS,
  WANDER_RADIUS,
  canTame,
  feedAnimal,
  getAnimalDefinition,
  pickWanderTarget,
  rollSpawnChance,
  shouldFlee,
  tickFlee,
  tickFollow,
  tickIdle,
  tickWander,
} from "./animals";
export type { AnimalBehavior, AnimalDefinition, AnimalSpecies } from "./animals";

// Quiz (pure; daily quiz mini-game with question bank and reward logic)
export {
  DAILY_QUIZ_COUNT,
  QUIZ_ENERGY_REWARD,
  QUIZ_QUESTIONS,
  QUIZ_REWARD_COINS,
  QUIZ_STREAK_BONUS_COINS,
  answerQuestion,
  calculateEnergyReward,
  calculateReward,
  canTakeQuiz,
  getDailyQuiz,
} from "./quiz";
export type {
  QuizAnswerOption,
  QuizCategory,
  QuizDifficulty,
  QuizQuestion,
  QuizState,
} from "./quiz";

// Collection (pure; museum donation and category tracking)
export {
  COLLECTION_CATEGORIES,
  COLLECTION_CATEGORY_IDS,
  canDonate,
  claimCategoryReward,
  donate,
  getCategory,
  getCategoryProgress,
  isCollectable,
  isCategoryComplete,
  totalCollectable,
  totalDonated,
} from "./collection";
export type { CollectionCategory, CollectionState } from "./collection";

// Achievements (pure; badge system with polled conditions)
export {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_IDS,
  checkAchievement,
  checkCondition,
  getAchievement,
  getUnlockedCount,
  getPendingAchievements,
  unlockAchievement,
} from "./achievements";
export type {
  AchievementCondition,
  AchievementDefinition,
  AchievementSource,
  AchievementState,
} from "./achievements";

// Accessibility (pure; inclusive design modes, palettes, announcements)
export {
  HIGH_CONTRAST_MODES,
  REDUCED_MOTION_MODES,
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_EXPIRY_MS,
  getHighContrastPalette,
  shouldReduceMotion,
  shouldEliminateMotion,
  getAnnouncementKey,
  createAnnouncement,
  pruneAnnouncements,
} from "./accessibility";
export type {
  HighContrastMode,
  ReducedMotionMode,
  AnnouncementType,
  Announcement,
} from "./accessibility";

// Housing (pure; interior rooms, furniture placement, happiness)
export {
  FURNITURE_DEFINITIONS,
  ROOM_DEFINITIONS,
  ROOM_TYPES,
  canEnterHouse,
  canPlaceFurniture,
  canUnlockRoom,
  createDefaultHousingState,
  createRoom,
  getAvailableFurniture,
  getFurnitureDefinition,
  getOverallHappiness,
  getRoomHappiness,
  placeFurniture,
  removeFurniture,
} from "./housing";
export type {
  FurnitureCategory,
  FurnitureDefinition,
  HousingState,
  PlacedFurniture,
  RoomDefinition,
  RoomState,
  RoomType,
} from "./housing";

// Shop maths (pure; the price table itself lives in `@worldnest/shared`)
export { applyTrade, buy, canTrade, sell, tradeQuote } from "./shop";
export {
  NPC_SHOP_CATALOGUES,
  RARE_ITEM_MARKUP,
  RARE_ITEM_ROTATION,
  SEASONAL_DISCOUNT_RATE,
  canBuyFromNpc,
  getEffectivePrice,
  getNpcShopItems,
  getRareItemForDay,
  getSeasonalDiscount,
  isRareItem,
} from "./shop";
export type { NpcShopCatalogue, Wallet } from "./shop";

// Quests (pure; titles and descriptions are i18n keys — decision D8)
export {
  QUEST_DEFINITIONS,
  QUEST_IDS,
  activateQuest,
  completeQuest,
  getEntry,
  getQuest,
  isObjectiveMet,
  objectiveProgress,
  objectiveTarget,
  offerQuest,
  pollProgress,
  recordDonation,
  recordTalk,
  recordTame,
} from "./quests";
export type {
  QuestDefinition,
  QuestLog,
  QuestObjective,
  QuestProgressSource,
  QuestReward,
  QuestRewardItem,
} from "./quests";

// Interaction helpers
export { FACING_OFFSETS, getFacedTile } from "./interaction";
export type { Facing } from "./interaction";

// Dialogue (pure; trees hold i18n keys, never sentences — decision D8)
export {
  DIALOGUE_DEFINITIONS,
  MAX_DIALOGUE_OPTIONS,
  activeNode,
  advanceDialogue,
  closeDialogue,
  dialogueQuestIds,
  getDialogue,
  getNode,
  openDialogue,
  resolveOption,
} from "./dialogue";
export type {
  DialogueAction,
  DialogueDefinition,
  DialogueNode,
  DialogueOption,
  DialogueState,
} from "./dialogue";

// Animation helpers (pure; the system only applies them)
export {
  advanceAnimation,
  directionFromDelta,
  directionalTextureKey,
} from "./animation";

// Systems
export {
  MovementSystem,
  InputSystem,
  ChunkSystem,
  RenderSystem,
  NetworkSyncSystem,
  InterpolationSystem,
  CollisionSystem,
  TimeSystem,
  EnvironmentSystem,
  StatsSystem,
  HarvestSystem,
  PlantSystem,
  LayerSystem,
  CropGrowthSystem,
  cropEntityId,
  cropStageAt,
  isCropMature,
  BuildSystem,
  structureEntityId,
  NpcSystem,
  npcEntityId,
  ShopSystem,
  QuestSystem,
  AnimationSystem,
  FishingSystem,
  CollectionSystem,
  AchievementSystem,
  CookingSystem,
  FestivalSystem,
  AnimalSystem,
  QuizSystem,
  AccessibilitySystem,
  HousingSystem,
  CraftingSystem,
  MusicSystem,
  TransportSystem,
  FriendshipSystem,
  ExplorationSystem,
  MissionSystem,
  GardeningSystem,
  WeatherGatheringSystem,
  ReputationSystem,
} from "./systems";
export type {
  RenderData,
  SyncPayload,
  NowFn,
  BiomeGetter,
  PhaseGetter,
  SetTileOverride,
  CropSource,
  LayerGetter,
  LayerSetter,
  MinuteGetter,
  StructureCounter,
  TalkListener,
  ClockSnapshotGetter,
  BiomeAtTile,
  RngFn,
  AchievementStructureCounter,
  DayGetter,
  TameListener,
  QuizDayGetter,
  QuizStreakListener,
  MusicCompleteListener,
  MountRideListener,
  GiftGivenListener,
  FriendshipMaxListener,
  MissionDayGetter,
  MissionWeekGetter,
  SeasonGetter,
  ShopDayGetter,
  WeatherRngFn,
} from "./systems";

// World Generation
export {
  ChunkGenerator,
  WorldManager,
  WorldLayer,
  getLayerTileKey,
  parseLayerTileKey,
  TileType,
  TILE_PROPERTIES,
  TILE_HARVEST_YIELD,
  Biome,
  BIOME_DEFINITIONS,
  classifyBiome,
  CROP_DEFINITIONS,
  isSeed,
  getTileKey,
  parseTileKey,
  sampleMinimap,
  minimapTileAt,
  composeBlockers,
  layerGuardedBlockers,
  NPC_DEFINITIONS,
  NPC_ROLES,
  NPC_PLACEMENT_MAX_RADIUS,
  getNpcDefinition,
  isNpcPlaceableTile,
  resolveNpcTile,
  scheduledEntry,
  WorldClock,
  PHASE_START_HOURS,
  Season,
  SEASON_DEFINITIONS,
  seasonForDay,
  WEATHER_KINDS,
  weatherPeriodIndex,
  weatherAt,
} from "./world";
export type {
  ChunkData,
  ChunkLoadCallback,
  ChunkUnloadCallback,
  TileChangeCallback,
  TileProperties,
  TileHarvestYield,
  MinimapSample,
  BiomeDefinition,
  CropDefinition,
  NpcDefinition,
  NpcRole,
  NpcActivity,
  NpcScheduleEntry,
  NpcTile,
  TileQuery,
  StructureQuery,
  ClockSnapshot,
  DayPhase,
  SeasonDefinition,
  WeatherKind,
} from "./world";
