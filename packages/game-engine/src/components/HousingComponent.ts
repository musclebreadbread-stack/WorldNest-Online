import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";
import type { RoomType } from "../housing/housingDefinitions";
import type { HousingState } from "../housing/housingState";
import { createDefaultHousingState } from "../housing/housingOps";

/** Request to place furniture in a room. */
export interface PlaceRequest {
  roomType: RoomType;
  itemId: ItemId;
  x: number;
  y: number;
}

/** Request to remove furniture from a room by index. */
export interface RemoveRequest {
  roomType: RoomType;
  index: number;
}

/**
 * Player housing interior state and HUD interaction requests.
 *
 * Pure data by design: all state transitions live in `housing/housingOps.ts`
 * and `systems/HousingSystem.ts`.
 */
export class HousingComponent extends Component {
  public state: HousingState;
  public enterRequested: boolean;
  public exitRequested: boolean;
  public placeRequested: PlaceRequest | null;
  public removeRequested: RemoveRequest | null;
  public unlockRequested: RoomType | null;
  public version: number;

  constructor() {
    super("housing");
    this.state = createDefaultHousingState();
    this.enterRequested = false;
    this.exitRequested = false;
    this.placeRequested = null;
    this.removeRequested = null;
    this.unlockRequested = null;
    this.version = 0;
  }
}
