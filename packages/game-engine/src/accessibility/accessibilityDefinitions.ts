/**
 * Accessibility mode definitions for inclusive design.
 *
 * Covers high-contrast palettes (including color-blind variants),
 * reduced-motion preferences, and ARIA live-region announcement types.
 */

/** Available contrast/color vision modes for the UI. */
export type HighContrastMode =
  "standard" | "high" | "colorblind_deuteranopia" | "colorblind_protanopia";

export const HIGH_CONTRAST_MODES: readonly HighContrastMode[] = [
  "standard",
  "high",
  "colorblind_deuteranopia",
  "colorblind_protanopia",
] as const;

/** Reduced-motion preference levels. */
export type ReducedMotionMode = "none" | "reduce" | "eliminate";

export const REDUCED_MOTION_MODES: readonly ReducedMotionMode[] = [
  "none",
  "reduce",
  "eliminate",
] as const;

/** Types of ARIA live-region announcements the game can emit. */
export type AnnouncementType =
  "item_pickup" | "quest_update" | "npc_dialogue" | "system_message";

export const ANNOUNCEMENT_TYPES: readonly AnnouncementType[] = [
  "item_pickup",
  "quest_update",
  "npc_dialogue",
  "system_message",
] as const;

/** A queued announcement waiting to be read aloud by the screen reader. */
export interface Announcement {
  type: AnnouncementType;
  key: string;
  params: Record<string, string | number>;
  timestamp: number;
}

/** Maximum age in milliseconds before an announcement is considered stale. */
export const ANNOUNCEMENT_EXPIRY_MS = 3000;
