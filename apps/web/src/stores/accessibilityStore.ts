import { create } from "zustand";
import type {
  Announcement,
  HighContrastMode,
  ReducedMotionMode,
} from "@worldnest/game-engine";

const STORAGE_KEY = "worldnest-accessibility";

interface PersistedState {
  highContrastMode: HighContrastMode;
  reducedMotionMode: ReducedMotionMode;
  keyboardNavigationEnabled: boolean;
}

interface AccessibilityState extends PersistedState {
  announcements: Announcement[];
  setHighContrastMode: (mode: HighContrastMode) => void;
  setReducedMotionMode: (mode: ReducedMotionMode) => void;
  setKeyboardNavigationEnabled: (enabled: boolean) => void;
  pushAnnouncement: (announcement: Announcement) => void;
  clearAnnouncements: () => void;
}

function loadPersistedState(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function persist(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable; silently ignore
  }
}

function detectReducedMotion(): ReducedMotionMode {
  if (typeof window === "undefined") return "none";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "reduce"
    : "none";
}

function detectHighContrast(): HighContrastMode {
  if (typeof window === "undefined") return "standard";
  return window.matchMedia("(prefers-contrast: more)").matches ? "high" : "standard";
}

/**
 * Accessibility preferences store. Reads OS-level media queries as defaults,
 * then applies any previously-persisted user choices on top.
 */
export const useAccessibilityStore = create<AccessibilityState>((set, get) => {
  const osDefaults: PersistedState = {
    highContrastMode: detectHighContrast(),
    reducedMotionMode: detectReducedMotion(),
    keyboardNavigationEnabled: false,
  };
  const persisted = loadPersistedState();
  const initial: PersistedState = { ...osDefaults, ...persisted };

  return {
    ...initial,
    announcements: [],

    setHighContrastMode: (mode) => {
      set({ highContrastMode: mode });
      const s = get();
      persist({
        highContrastMode: mode,
        reducedMotionMode: s.reducedMotionMode,
        keyboardNavigationEnabled: s.keyboardNavigationEnabled,
      });
    },

    setReducedMotionMode: (mode) => {
      set({ reducedMotionMode: mode });
      const s = get();
      persist({
        highContrastMode: s.highContrastMode,
        reducedMotionMode: mode,
        keyboardNavigationEnabled: s.keyboardNavigationEnabled,
      });
    },

    setKeyboardNavigationEnabled: (enabled) => {
      set({ keyboardNavigationEnabled: enabled });
      const s = get();
      persist({
        highContrastMode: s.highContrastMode,
        reducedMotionMode: s.reducedMotionMode,
        keyboardNavigationEnabled: enabled,
      });
    },

    pushAnnouncement: (announcement) => {
      set((state) => ({
        announcements: [...state.announcements, announcement],
      }));
    },

    clearAnnouncements: () => set({ announcements: [] }),
  };
});
