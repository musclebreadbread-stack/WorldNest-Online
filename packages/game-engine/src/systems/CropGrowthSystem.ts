import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { CropComponent } from "../components/CropComponent";
import { SpriteComponent } from "../components/SpriteComponent";

/** Reads the current world-clock minute, normally off the clock entity. */
export type MinuteGetter = () => number;

/**
 * CropGrowthSystem derives each crop's stage from the shared world clock.
 *
 * Nothing is accumulated per frame: the stage is a pure function of the clock and
 * the plant time, so a client that was closed for a while catches up instantly.
 * The clock arrives through an injected getter, like `StatsSystem`'s phase.
 */
export class CropGrowthSystem extends System {
  private getNowMinutes: MinuteGetter;

  constructor(getNowMinutes: MinuteGetter = () => 0) {
    super(["crop"]);
    this.getNowMinutes = getNowMinutes;
  }

  update(entities: Entity[], _deltaTime: number): void {
    if (entities.length === 0) return;

    const nowMinutes = this.getNowMinutes();

    for (const entity of entities) {
      const crop = entity.getComponent<CropComponent>("crop")!;
      const stage = cropStageAt(crop, nowMinutes);
      if (stage === crop.stage) continue;

      crop.stage = stage;
      // The sprite frame carries the stage; the renderer maps it to a texture.
      const sprite = entity.getComponent<SpriteComponent>("sprite");
      if (sprite) sprite.frame = stage;
    }
  }
}

/** Growth stage of a crop at a given world-clock minute, saturating when mature. */
export function cropStageAt(crop: CropComponent, nowMinutes: number): number {
  const elapsed = nowMinutes - crop.plantedAtMinute;
  const stage = Math.floor(elapsed / crop.minutesPerStage);
  return Math.max(0, Math.min(stage, crop.stageCount - 1));
}

/** Whether a crop has reached its last growth stage. */
export function isCropMature(crop: CropComponent): boolean {
  return crop.stage >= crop.stageCount - 1;
}
