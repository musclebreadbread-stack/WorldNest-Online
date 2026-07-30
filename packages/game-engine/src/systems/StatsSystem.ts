import { GAME_MINUTES_PER_REAL_SECOND } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { StatsComponent } from "../components/StatsComponent";
import type { DayPhase } from "../world/WorldClock";

/** Reads the current day phase, normally off the world clock entity. */
export type PhaseGetter = () => DayPhase;

/** Resting at night recovers energy twice as fast. */
const NIGHT_REGEN_MULTIPLIER = 2;

/**
 * StatsSystem regenerates energy over time, clamped to `maxEnergy`.
 *
 * The day phase arrives through an injected getter rather than by querying the
 * world for the clock entity, which keeps the system testable in isolation.
 */
export class StatsSystem extends System {
  private getPhase: PhaseGetter;

  constructor(getPhase: PhaseGetter = () => "day") {
    super(["stats"]);
    this.getPhase = getPhase;
  }

  update(entities: Entity[], deltaTime: number): void {
    if (entities.length === 0) return;

    const multiplier = this.getPhase() === "night" ? NIGHT_REGEN_MULTIPLIER : 1;
    const gameMinutes = deltaTime * GAME_MINUTES_PER_REAL_SECOND;

    for (const entity of entities) {
      const stats = entity.getComponent<StatsComponent>("stats")!;
      if (stats.energy >= stats.maxEnergy) {
        stats.energy = stats.maxEnergy;
        continue;
      }

      stats.energy = Math.min(
        stats.maxEnergy,
        stats.energy + stats.regenPerMinute * gameMinutes * multiplier,
      );
    }
  }
}
