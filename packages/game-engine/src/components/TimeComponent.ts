import { Component } from "../ecs/Component";
import { WorldClock, type ClockSnapshot } from "../world/WorldClock";

/**
 * Latest world clock snapshot, refreshed by TimeSystem.
 * Held by a single `world-clock` entity so any system (and the HUD) can read the
 * current time without recomputing it.
 */
export class TimeComponent extends Component {
  public snapshot: ClockSnapshot;

  constructor(snapshot: ClockSnapshot = WorldClock.fromWallClock(Date.now())) {
    super("time");
    this.snapshot = snapshot;
  }
}
