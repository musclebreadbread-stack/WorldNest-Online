import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { AccessibilityComponent } from "../components/AccessibilityComponent";
import { pruneAnnouncements } from "../accessibility/accessibilityOps";

/**
 * AccessibilitySystem processes entities with an 'accessibility' component.
 *
 * Each frame it:
 * - Removes stale announcements that are older than 3 seconds.
 *
 * The system is intentionally lightweight: announcement creation happens
 * in the bridge layer (web) which has access to inventory/quest diffs.
 */
export class AccessibilitySystem extends System {
  private nowFn: () => number;

  constructor(nowFn?: () => number) {
    super(["accessibility"]);
    this.nowFn = nowFn ?? (() => Date.now());
  }

  update(entities: Entity[], _deltaTime: number): void {
    const now = this.nowFn();

    for (const entity of entities) {
      const a11y = entity.getComponent<AccessibilityComponent>("accessibility")!;

      if (a11y.announcements.length === 0) continue;

      const pruned = pruneAnnouncements(a11y.announcements, now);
      if (pruned.length !== a11y.announcements.length) {
        a11y.announcements = pruned;
        a11y.version++;
      }
    }
  }
}
