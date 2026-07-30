import { Component } from "../ecs/Component";

/**
 * Interpolation target for a remote player entity.
 * Network updates write the target; InterpolationSystem eases the position
 * toward it so remote players move smoothly between sparse updates.
 */
export class RemoteInterpolationComponent extends Component {
  public targetX: number;
  public targetY: number;
  public lerpFactor: number;

  constructor(targetX: number = 0, targetY: number = 0, lerpFactor: number = 0.2) {
    super("remoteInterpolation");
    this.targetX = targetX;
    this.targetY = targetY;
    this.lerpFactor = lerpFactor;
  }
}
