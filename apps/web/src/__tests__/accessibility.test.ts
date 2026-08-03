import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Announcement } from "@worldnest/game-engine";

// matchMedia does not exist in jsdom; stub it before importing the store
// since Zustand evaluates the create callback on first import.
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Now safe to import (matchMedia exists on window)
const { useAccessibilityStore } = await import("../stores/accessibilityStore");

describe("accessibilityStore", () => {
  beforeEach(() => {
    useAccessibilityStore.setState({
      highContrastMode: "standard",
      reducedMotionMode: "none",
      keyboardNavigationEnabled: false,
      announcements: [],
    });
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
  });

  it("should initialize with standard defaults", () => {
    const state = useAccessibilityStore.getState();
    expect(state.highContrastMode).toBe("standard");
    expect(state.reducedMotionMode).toBe("none");
    expect(state.keyboardNavigationEnabled).toBe(false);
    expect(state.announcements).toEqual([]);
  });

  it("should set high contrast mode", () => {
    useAccessibilityStore.getState().setHighContrastMode("high");
    expect(useAccessibilityStore.getState().highContrastMode).toBe("high");
  });

  it("should set reduced motion mode", () => {
    useAccessibilityStore.getState().setReducedMotionMode("reduce");
    expect(useAccessibilityStore.getState().reducedMotionMode).toBe("reduce");
  });

  it("should set keyboard navigation enabled", () => {
    useAccessibilityStore.getState().setKeyboardNavigationEnabled(true);
    expect(useAccessibilityStore.getState().keyboardNavigationEnabled).toBe(true);
  });

  it("should push announcements to the queue", () => {
    const announcement: Announcement = {
      type: "item_pickup",
      key: "a11y.itemPickup",
      params: { item: "wood" },
      timestamp: 1000,
    };
    useAccessibilityStore.getState().pushAnnouncement(announcement);
    expect(useAccessibilityStore.getState().announcements).toHaveLength(1);
    expect(useAccessibilityStore.getState().announcements[0]).toEqual(announcement);
  });

  it("should clear all announcements", () => {
    const announcement: Announcement = {
      type: "item_pickup",
      key: "a11y.itemPickup",
      params: { item: "wood" },
      timestamp: 1000,
    };
    useAccessibilityStore.getState().pushAnnouncement(announcement);
    useAccessibilityStore.getState().clearAnnouncements();
    expect(useAccessibilityStore.getState().announcements).toEqual([]);
  });

  it("should persist high contrast mode to localStorage", () => {
    useAccessibilityStore.getState().setHighContrastMode("colorblind_deuteranopia");
    const stored = JSON.parse(localStorage.getItem("worldnest-accessibility") ?? "{}");
    expect(stored.highContrastMode).toBe("colorblind_deuteranopia");
  });

  it("should persist reduced motion mode to localStorage", () => {
    useAccessibilityStore.getState().setReducedMotionMode("eliminate");
    const stored = JSON.parse(localStorage.getItem("worldnest-accessibility") ?? "{}");
    expect(stored.reducedMotionMode).toBe("eliminate");
  });

  it("should persist keyboard navigation to localStorage", () => {
    useAccessibilityStore.getState().setKeyboardNavigationEnabled(true);
    const stored = JSON.parse(localStorage.getItem("worldnest-accessibility") ?? "{}");
    expect(stored.keyboardNavigationEnabled).toBe(true);
  });

  it("should accumulate multiple announcements", () => {
    const store = useAccessibilityStore.getState();
    store.pushAnnouncement({
      type: "item_pickup",
      key: "a11y.itemPickup",
      params: { item: "wood" },
      timestamp: 1000,
    });
    store.pushAnnouncement({
      type: "quest_update",
      key: "a11y.questUpdate",
      params: { quest: "test" },
      timestamp: 2000,
    });
    expect(useAccessibilityStore.getState().announcements).toHaveLength(2);
  });

  it("should support colorblind protanopia mode", () => {
    useAccessibilityStore.getState().setHighContrastMode("colorblind_protanopia");
    expect(useAccessibilityStore.getState().highContrastMode).toBe(
      "colorblind_protanopia",
    );
  });
});
