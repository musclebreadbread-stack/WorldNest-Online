import { Component } from "../ecs/Component";
import type { ItemId } from "@worldnest/shared";
import type { WeatherKind } from "../world/Weather";
import type { WeatherNotification } from "../gathering";

/**
 * Tracks a player's weather-enhanced gathering state.
 *
 * Pure data. Logic lives in `gathering/weatherGatheringOps.ts` and the
 * system in `WeatherGatheringSystem`.
 */
export class WeatherGatheringComponent extends Component {
  /** Count of each weather-exclusive item gathered. */
  public gatheredItems: Map<ItemId, number>;
  /** Notifications queue for weather changes with gatherable items. */
  public weatherNotifications: WeatherNotification[];
  /** Timestamp of the last successful gather attempt. */
  public lastGatherTime: number;
  /** How long the current weather has been active (ms). */
  public currentWeatherDuration: number;
  /** Pending gather request (set externally, consumed by system). */
  public pendingGather: boolean;
  /** Last known weather for detecting changes. */
  public lastKnownWeather: WeatherKind | null;
  /** Monotonically increasing version for change detection. */
  public version: number;

  constructor() {
    super("weatherGathering");
    this.gatheredItems = new Map();
    this.weatherNotifications = [];
    this.lastGatherTime = 0;
    this.currentWeatherDuration = 0;
    this.pendingGather = false;
    this.lastKnownWeather = null;
    this.version = 0;
  }
}
