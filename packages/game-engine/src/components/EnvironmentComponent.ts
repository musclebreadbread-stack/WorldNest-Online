import { Component } from "../ecs/Component";
import type { Biome } from "../world/Biomes";
import type { Season } from "../world/Seasons";
import type { WeatherKind } from "../world/Weather";

/**
 * Data-only snapshot of the environment. Written by `EnvironmentSystem`,
 * read by the HUD, the weather overlay and the stats regeneration modifier.
 */
export class EnvironmentComponent extends Component {
  public season: Season | null = null;
  public weather: WeatherKind | null = null;
  public biome: Biome | null = null;
  public temperature: number = 0;
  public energyRegenMultiplier: number = 1;
  public version: number = 0;

  constructor() {
    super("environment");
  }
}
