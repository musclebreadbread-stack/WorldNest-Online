import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { AccessibilityComponent } from "../components/AccessibilityComponent";
import { AccessibilitySystem } from "../systems/AccessibilitySystem";
import {
  HIGH_CONTRAST_MODES,
  REDUCED_MOTION_MODES,
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_EXPIRY_MS,
} from "../accessibility/accessibilityDefinitions";
import type { Announcement } from "../accessibility/accessibilityDefinitions";
import {
  getHighContrastPalette,
  shouldReduceMotion,
  shouldEliminateMotion,
  getAnnouncementKey,
  createAnnouncement,
  pruneAnnouncements,
} from "../accessibility/accessibilityOps";

interface Harness {
  entity: Entity;
  a11y: AccessibilityComponent;
  system: AccessibilitySystem;
}

function createHarness(nowFn?: () => number): Harness {
  const a11y = new AccessibilityComponent();
  const entity = new Entity("player").addComponent(a11y);
  const system = new AccessibilitySystem(nowFn);
  return { entity, a11y, system };
}

describe("accessibilityDefinitions", () => {
  it("should define exactly 4 high contrast modes", () => {
    expect(HIGH_CONTRAST_MODES).toHaveLength(4);
    expect(HIGH_CONTRAST_MODES).toContain("standard");
    expect(HIGH_CONTRAST_MODES).toContain("high");
    expect(HIGH_CONTRAST_MODES).toContain("colorblind_deuteranopia");
    expect(HIGH_CONTRAST_MODES).toContain("colorblind_protanopia");
  });

  it("should define exactly 3 reduced motion modes", () => {
    expect(REDUCED_MOTION_MODES).toHaveLength(3);
    expect(REDUCED_MOTION_MODES).toContain("none");
    expect(REDUCED_MOTION_MODES).toContain("reduce");
    expect(REDUCED_MOTION_MODES).toContain("eliminate");
  });

  it("should define exactly 4 announcement types", () => {
    expect(ANNOUNCEMENT_TYPES).toHaveLength(4);
    expect(ANNOUNCEMENT_TYPES).toContain("item_pickup");
    expect(ANNOUNCEMENT_TYPES).toContain("quest_update");
    expect(ANNOUNCEMENT_TYPES).toContain("npc_dialogue");
    expect(ANNOUNCEMENT_TYPES).toContain("system_message");
  });

  it("should set expiry to 3000ms", () => {
    expect(ANNOUNCEMENT_EXPIRY_MS).toBe(3000);
  });
});

describe("getHighContrastPalette", () => {
  it("should return empty object for standard mode", () => {
    const palette = getHighContrastPalette("standard");
    expect(Object.keys(palette)).toHaveLength(0);
  });

  it("should return CSS variables for high contrast mode", () => {
    const palette = getHighContrastPalette("high");
    expect(palette["--a11y-bg"]).toBe("#000000");
    expect(palette["--a11y-fg"]).toBe("#ffffff");
    expect(palette["--a11y-primary"]).toBe("#ffff00");
    expect(palette["--a11y-secondary"]).toBe("#00ffff");
    expect(palette["--a11y-border"]).toBe("#ffffff");
    expect(palette["--a11y-focus"]).toBe("#ff8800");
  });

  it("should return deuteranopia-safe palette", () => {
    const palette = getHighContrastPalette("colorblind_deuteranopia");
    expect(palette["--a11y-primary"]).toBe("#4a90d9");
    expect(palette["--a11y-secondary"]).toBe("#d4a843");
  });

  it("should return protanopia-safe palette", () => {
    const palette = getHighContrastPalette("colorblind_protanopia");
    expect(palette["--a11y-primary"]).toBe("#56b4e9");
    expect(palette["--a11y-secondary"]).toBe("#e69f00");
  });

  it("should include 6 CSS variables for non-standard modes", () => {
    expect(Object.keys(getHighContrastPalette("high"))).toHaveLength(6);
    expect(Object.keys(getHighContrastPalette("colorblind_deuteranopia"))).toHaveLength(
      6,
    );
    expect(Object.keys(getHighContrastPalette("colorblind_protanopia"))).toHaveLength(
      6,
    );
  });
});

describe("shouldReduceMotion", () => {
  it("should return false for none", () => {
    expect(shouldReduceMotion("none")).toBe(false);
  });

  it("should return true for reduce", () => {
    expect(shouldReduceMotion("reduce")).toBe(true);
  });

  it("should return true for eliminate", () => {
    expect(shouldReduceMotion("eliminate")).toBe(true);
  });
});

describe("shouldEliminateMotion", () => {
  it("should return false for none", () => {
    expect(shouldEliminateMotion("none")).toBe(false);
  });

  it("should return false for reduce", () => {
    expect(shouldEliminateMotion("reduce")).toBe(false);
  });

  it("should return true for eliminate", () => {
    expect(shouldEliminateMotion("eliminate")).toBe(true);
  });
});

describe("getAnnouncementKey", () => {
  it("should return item pickup key", () => {
    expect(getAnnouncementKey("item_pickup", { item: "wood" })).toBe("a11y.itemPickup");
  });

  it("should return quest update key", () => {
    expect(getAnnouncementKey("quest_update", { quest: "test" })).toBe(
      "a11y.questUpdate",
    );
  });

  it("should return npc dialogue key", () => {
    expect(getAnnouncementKey("npc_dialogue", { npc: "Pip" })).toBe("a11y.npcDialogue");
  });

  it("should return system message key from params when available", () => {
    expect(getAnnouncementKey("system_message", { messageKey: "custom.key" })).toBe(
      "custom.key",
    );
  });

  it("should return default system message key without messageKey", () => {
    expect(getAnnouncementKey("system_message", {})).toBe("a11y.systemMessage");
  });
});

describe("createAnnouncement", () => {
  it("should create announcement with timestamp", () => {
    const a = createAnnouncement("item_pickup", { item: "wood" }, 5000);
    expect(a.type).toBe("item_pickup");
    expect(a.key).toBe("a11y.itemPickup");
    expect(a.params).toEqual({ item: "wood" });
    expect(a.timestamp).toBe(5000);
  });
});

describe("pruneAnnouncements", () => {
  it("should keep fresh announcements", () => {
    const announcements: Announcement[] = [
      createAnnouncement("item_pickup", { item: "wood" }, 1000),
    ];
    const result = pruneAnnouncements(announcements, 2000);
    expect(result).toHaveLength(1);
  });

  it("should remove expired announcements", () => {
    const announcements: Announcement[] = [
      createAnnouncement("item_pickup", { item: "wood" }, 1000),
    ];
    const result = pruneAnnouncements(announcements, 5000);
    expect(result).toHaveLength(0);
  });

  it("should keep announcements at exactly boundary (< not <=)", () => {
    const announcements: Announcement[] = [
      createAnnouncement("item_pickup", { item: "wood" }, 1000),
    ];
    // At time 3999 the age is 2999 which is < 3000
    const result = pruneAnnouncements(announcements, 3999);
    expect(result).toHaveLength(1);
  });

  it("should remove announcements at expiry boundary", () => {
    const announcements: Announcement[] = [
      createAnnouncement("item_pickup", { item: "wood" }, 1000),
    ];
    // At time 4000 the age is 3000 which is NOT < 3000
    const result = pruneAnnouncements(announcements, 4000);
    expect(result).toHaveLength(0);
  });
});

describe("AccessibilityComponent", () => {
  it("should have type accessibility", () => {
    const comp = new AccessibilityComponent();
    expect(comp.type).toBe("accessibility");
  });

  it("should initialize with standard defaults", () => {
    const comp = new AccessibilityComponent();
    expect(comp.highContrastMode).toBe("standard");
    expect(comp.reducedMotionMode).toBe("none");
    expect(comp.keyboardNavigationEnabled).toBe(false);
    expect(comp.focusedPanelId).toBeNull();
    expect(comp.announcements).toEqual([]);
    expect(comp.version).toBe(0);
  });
});

describe("AccessibilitySystem", () => {
  it("should require only accessibility component", () => {
    const { system, entity } = createHarness();
    const unrelated = new Entity("prop");
    expect(system.matches(entity)).toBe(true);
    expect(system.matches(unrelated)).toBe(false);
  });

  it("should not modify version when no announcements exist", () => {
    const { entity, a11y, system } = createHarness(() => 5000);
    system.update([entity], 1 / 60);
    expect(a11y.version).toBe(0);
  });

  it("should prune stale announcements and bump version", () => {
    let now = 1000;
    const { entity, a11y, system } = createHarness(() => now);

    a11y.announcements.push(createAnnouncement("item_pickup", { item: "wood" }, 1000));

    // Still fresh at 2000
    now = 2000;
    system.update([entity], 1 / 60);
    expect(a11y.announcements).toHaveLength(1);
    expect(a11y.version).toBe(0);

    // Expired at 5000 (age = 4000 > 3000)
    now = 5000;
    system.update([entity], 1 / 60);
    expect(a11y.announcements).toHaveLength(0);
    expect(a11y.version).toBe(1);
  });

  it("should keep fresh announcements and remove only stale ones", () => {
    const now = 5000;
    const { entity, a11y, system } = createHarness(() => now);

    a11y.announcements.push(
      createAnnouncement("item_pickup", { item: "wood" }, 1000),
      createAnnouncement("quest_update", { quest: "test" }, 4000),
    );

    system.update([entity], 1 / 60);
    expect(a11y.announcements).toHaveLength(1);
    expect(a11y.announcements[0].type).toBe("quest_update");
    expect(a11y.version).toBe(1);
  });
});
