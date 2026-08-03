export {
  HIGH_CONTRAST_MODES,
  REDUCED_MOTION_MODES,
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_EXPIRY_MS,
} from "./accessibilityDefinitions";
export type {
  HighContrastMode,
  ReducedMotionMode,
  AnnouncementType,
  Announcement,
} from "./accessibilityDefinitions";
export {
  getHighContrastPalette,
  shouldReduceMotion,
  shouldEliminateMotion,
  getAnnouncementKey,
  createAnnouncement,
  pruneAnnouncements,
} from "./accessibilityOps";
