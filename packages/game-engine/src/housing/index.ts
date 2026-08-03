export {
  FURNITURE_DEFINITIONS,
  ROOM_DEFINITIONS,
  ROOM_TYPES,
  getFurnitureDefinition,
} from "./housingDefinitions";
export type {
  FurnitureCategory,
  FurnitureDefinition,
  RoomDefinition,
  RoomType,
} from "./housingDefinitions";
export {
  canEnterHouse,
  canPlaceFurniture,
  canUnlockRoom,
  createDefaultHousingState,
  createRoom,
  getAvailableFurniture,
  getOverallHappiness,
  getRoomHappiness,
  placeFurniture,
  removeFurniture,
} from "./housingOps";
export type { HousingState, PlacedFurniture, RoomState } from "./housingState";
