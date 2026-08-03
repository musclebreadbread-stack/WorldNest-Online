import type {
  Announcement,
  AnnouncementType,
  HighContrastMode,
  ReducedMotionMode,
} from "./accessibilityDefinitions";
import { ANNOUNCEMENT_EXPIRY_MS } from "./accessibilityDefinitions";

/**
 * CSS custom properties map for each contrast/color-vision mode.
 * Standard returns an empty map (default palette applies).
 */
export function getHighContrastPalette(mode: HighContrastMode): Record<string, string> {
  switch (mode) {
    case "standard":
      return {};
    case "high":
      return {
        "--a11y-bg": "#000000",
        "--a11y-fg": "#ffffff",
        "--a11y-primary": "#ffff00",
        "--a11y-secondary": "#00ffff",
        "--a11y-border": "#ffffff",
        "--a11y-focus": "#ff8800",
      };
    case "colorblind_deuteranopia":
      return {
        "--a11y-bg": "#1a1a2e",
        "--a11y-fg": "#eaeaea",
        "--a11y-primary": "#4a90d9",
        "--a11y-secondary": "#d4a843",
        "--a11y-border": "#8899aa",
        "--a11y-focus": "#e07020",
      };
    case "colorblind_protanopia":
      return {
        "--a11y-bg": "#1a1a2e",
        "--a11y-fg": "#eaeaea",
        "--a11y-primary": "#56b4e9",
        "--a11y-secondary": "#e69f00",
        "--a11y-border": "#8899aa",
        "--a11y-focus": "#cc79a7",
      };
  }
}

/**
 * Whether animations should be suppressed for the given mode.
 * `none` allows full motion; `reduce` and `eliminate` both suppress.
 */
export function shouldReduceMotion(mode: ReducedMotionMode): boolean {
  return mode !== "none";
}

/**
 * Whether animations should be entirely removed (no transitions at all).
 */
export function shouldEliminateMotion(mode: ReducedMotionMode): boolean {
  return mode === "eliminate";
}

/**
 * Returns the i18n key string for a given announcement type.
 * The key can then be passed to the translation layer with params.
 */
export function getAnnouncementKey(
  type: AnnouncementType,
  params: Record<string, string | number>,
): string {
  switch (type) {
    case "item_pickup":
      return "a11y.itemPickup";
    case "quest_update":
      return "a11y.questUpdate";
    case "npc_dialogue":
      return `a11y.npcDialogue`;
    case "system_message":
      return params["messageKey"] ? String(params["messageKey"]) : "a11y.systemMessage";
  }
}

/**
 * Create a new announcement entry with the current timestamp.
 */
export function createAnnouncement(
  type: AnnouncementType,
  params: Record<string, string | number>,
  now: number,
): Announcement {
  return {
    type,
    key: getAnnouncementKey(type, params),
    params,
    timestamp: now,
  };
}

/**
 * Remove stale announcements older than the expiry threshold.
 * Returns only the announcements that are still fresh.
 */
export function pruneAnnouncements(
  announcements: Announcement[],
  now: number,
): Announcement[] {
  return announcements.filter((a) => now - a.timestamp < ANNOUNCEMENT_EXPIRY_MS);
}
