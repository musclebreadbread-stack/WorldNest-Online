import { Component } from "../ecs/Component";

export class VelocityComponent extends Component {
  public vx: number;
  public vy: number;

  constructor(vx: number = 0, vy: number = 0) {
    super("velocity");
    this.vx = vx;
    this.vy = vy;
  }
}
