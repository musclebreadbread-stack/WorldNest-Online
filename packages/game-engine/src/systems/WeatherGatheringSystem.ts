import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { WeatherGatheringComponent } from "../components/WeatherGatheringComponent";
import { EnvironmentComponent } from "../components/EnvironmentComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import {
  canGatherWeatherItem,
  pushWeatherNotification,
  recordWeatherGather,
  rollWeatherGather,
} from "../gathering/weatherGatheringOps";
import { addItem } from "../inventory";

export type WeatherRngFn = () => number;

/**
 * WeatherGatheringSystem reads current weather from EnvironmentComponent,
 * manages gather cooldowns, adds items to inventory, and pushes notifications
 * when weather changes to one with exclusive items.
 *
 * Requires: weatherGathering, environment, inventory, position.
 */
export class WeatherGatheringSystem extends System {
  private nowFn: () => number;
  private rngFn: WeatherRngFn;

  constructor(nowFn: () => number, rngFn: WeatherRngFn = Math.random) {
    super(["weatherGathering", "environment", "inventory", "position"]);
    this.nowFn = nowFn;
    this.rngFn = rngFn;
  }

  update(entities: Entity[], deltaTime: number): void {
    const now = this.nowFn();
    const deltaMs = deltaTime * 1000;

    for (const entity of entities) {
      const wg = entity.getComponent<WeatherGatheringComponent>("weatherGathering")!;
      const env = entity.getComponent<EnvironmentComponent>("environment")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;

      this.trackWeatherChange(wg, env, now, deltaMs);
      this.consumeGather(wg, env, inventory, now);
    }
  }

  private trackWeatherChange(
    wg: WeatherGatheringComponent,
    env: EnvironmentComponent,
    now: number,
    deltaMs: number,
  ): void {
    if (env.weather !== wg.lastKnownWeather) {
      // Weather changed
      wg.currentWeatherDuration = 0;
      if (env.weather) {
        pushWeatherNotification(wg, env.weather, now);
      }
      wg.lastKnownWeather = env.weather;
    } else {
      wg.currentWeatherDuration += deltaMs;
    }
  }

  private consumeGather(
    wg: WeatherGatheringComponent,
    env: EnvironmentComponent,
    inventory: InventoryComponent,
    now: number,
  ): void {
    if (!wg.pendingGather) return;
    wg.pendingGather = false;

    if (!canGatherWeatherItem(env.weather, wg.lastGatherTime, now)) {
      return;
    }

    const result = rollWeatherGather(env.weather!, this.rngFn());
    if (!result) return;

    addItem(inventory, result.itemId, 1);
    recordWeatherGather(wg, result.itemId, now);
  }
}
