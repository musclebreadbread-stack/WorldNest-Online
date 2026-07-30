import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { TimeComponent } from "../components/TimeComponent";
import { WorldClock } from "../world/WorldClock";

/** Source of wall-clock milliseconds; injectable so tests can freeze time. */
export type NowFn = () => number;

/**
 * TimeSystem refreshes every TimeComponent from the wall clock.
 * It deliberately ignores `deltaTime`: the clock is derived, not accumulated,
 * so a stalled or backgrounded tab catches up instantly.
 */
export class TimeSystem extends System {
  private nowFn: NowFn;

  constructor(nowFn: NowFn = () => Date.now()) {
    super(["time"]);
    this.nowFn = nowFn;
  }

  update(entities: Entity[], _deltaTime: number): void {
    if (entities.length === 0) return;

    const snapshot = WorldClock.fromWallClock(this.nowFn());
    for (const entity of entities) {
      entity.getComponent<TimeComponent>("time")!.snapshot = snapshot;
    }
  }
}
