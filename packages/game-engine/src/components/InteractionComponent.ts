import { Component } from "../ecs/Component";
import type { Facing } from "../interaction/facing";

/**
 * Interaction intent for an entity: which way it is facing and whether it asked
 * to act on the tile in front of it this frame. The systems that consume the
 * request (harvesting, and later planting and building) clear the flag.
 */
export class InteractionComponent extends Component {
  public facing: Facing;
  public interactRequested: boolean;
  /** Wall-clock ms of the last request; the input layer uses it as a cooldown. */
  public lastInteractAt: number;
  /** Asked to place the selected item on the faced tile this frame. */
  public buildRequested: boolean;
  public lastBuildAt: number;

  constructor(facing: Facing = "down") {
    super("interaction");
    this.facing = facing;
    this.interactRequested = false;
    this.lastInteractAt = 0;
    this.buildRequested = false;
    this.lastBuildAt = 0;
  }
}
