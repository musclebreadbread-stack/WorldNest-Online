export {
  BOAT_SPEED_MULTIPLIER,
  MOUNT_DEFINITIONS,
  MOUNT_FEED_RESTORE,
  MOUNT_SPECIES,
  MOUNT_STAMINA_DRAIN_PER_SECOND,
} from "./transportDefinitions";
export type { MountDefinition, MountSpecies } from "./transportDefinitions";
export type { MountState, TransportMode } from "./transportState";
export {
  boatCanTraverse,
  calculateSpeed,
  canBoard,
  canMount,
  dismount,
  feedMount,
  getMountBondLevel,
  isMountExhausted,
  mount,
  tickMountStamina,
} from "./transportOps";
