import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { EnvironmentComponent } from "../components/EnvironmentComponent";
import { TimeComponent } from "../components/TimeComponent";
import type { Biome } from "../world/Biomes";
import { deriveEnvironment } from "../world/environmentOps";

/** Returns the biome at the player's current tile. */
export type BiomeGetter = () => Biome;

/**
 * EnvironmentSystem derives season, weather, temperature and the energy
 * regeneration multiplier from the clock and the player's biome.
 *
 * Registered immediately after TimeSystem so every later system sees this
 * frame's weather. Bumps `version` only when something actually changes.
 */
export class EnvironmentSystem extends System {
  private getBiome: BiomeGetter;

  constructor(getBiome: BiomeGetter) {
    super(["time", "environment"]);
    this.getBiome = getBiome;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const time = entity.getComponent<TimeComponent>("time")!;
      const env = entity.getComponent<EnvironmentComponent>("environment")!;

      const biome = this.getBiome();
      const snapshot = time.snapshot;
      if (!snapshot) continue;

      const state = deriveEnvironment(snapshot, biome);

      // Only bump version when something actually changed
      if (
        env.season !== state.season ||
        env.weather !== state.weather ||
        env.biome !== state.biome
      ) {
        env.season = state.season;
        env.weather = state.weather;
        env.biome = state.biome;
        env.temperature = state.temperature;
        env.energyRegenMultiplier = state.energyRegenMultiplier;
        env.version++;
      } else if (env.temperature !== state.temperature) {
        env.temperature = state.temperature;
        env.energyRegenMultiplier = state.energyRegenMultiplier;
        // Temperature drift within same weather does not bump version
      }
    }
  }
}
