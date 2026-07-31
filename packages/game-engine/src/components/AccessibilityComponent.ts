import { Component } from "../ecs/Component";
import type {
  Announcement,
  HighContrastMode,
  ReducedMotionMode,
} from "../accessibility/accessibilityDefinitions";

/**
 * Accessibility preferences and state for an entity.
 *
 * Pure data by design: all state transitions live in
 * `accessibility/accessibilityOps.ts` and `systems/AccessibilitySystem.ts`.
 */
export class AccessibilityComponent extends Component {
  /** Active high-contrast / color-blind palette mode. */
  public highContrastMode: HighContrastMode;
  /** Active reduced-motion preference. */
  public reducedMotionMode: ReducedMotionMode;
  /** Whether keyboard-only navigation focus management is active. */
  public keyboardNavigationEnabled: boolean;
  /** The panel currently holding keyboard focus, or null. */
  public focusedPanelId: string | null;
  /** Queue of announcements for the screen reader live region. */
  public announcements: Announcement[];
  /** Bumped on every state change so the UI can detect transitions. */
  public version: number;

  constructor() {
    super("accessibility");
    this.highContrastMode = "standard";
    this.reducedMotionMode = "none";
    this.keyboardNavigationEnabled = false;
    this.focusedPanelId = null;
    this.announcements = [];
    this.version = 0;
  }
}
