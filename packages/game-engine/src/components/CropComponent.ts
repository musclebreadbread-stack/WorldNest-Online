import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";

/**
 * A crop growing on a farmland tile.
 *
 * `plantedAtMinute` is a world-clock minute rather than a wall-clock timestamp,
 * so growth is identical on every client and survives a reload.
 */
export class CropComponent extends Component {
  /** Seed the crop was sown from; keys `CROP_DEFINITIONS`. */
  public itemId: ItemId;
  public plantedAtMinute: number;
  public stageCount: number;
  public minutesPerStage: number;
  /** Current growth stage, `stageCount - 1` meaning mature. */
  public stage: number;
  public tileX: number;
  public tileY: number;

  constructor(
    itemId: ItemId,
    plantedAtMinute: number,
    stageCount: number,
    minutesPerStage: number,
    tileX: number,
    tileY: number,
  ) {
    super("crop");
    this.itemId = itemId;
    this.plantedAtMinute = plantedAtMinute;
    this.stageCount = stageCount;
    this.minutesPerStage = minutesPerStage;
    this.stage = 0;
    this.tileX = tileX;
    this.tileY = tileY;
  }
}
