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
} from "./components";
export type {
  KeyState,
  InventorySlot,
  AnimationState,
  QuestEntry,
  QuestState,
  ShopTrade,
  ShopTradeKind,
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

// Shop maths (pure; the price table itself lives in `@worldnest/shared`)
export { applyTrade, buy, canTrade, sell, tradeQuote } from "./shop";
export type { Wallet } from "./shop";

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
