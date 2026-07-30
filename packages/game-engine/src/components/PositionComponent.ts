import { Component } from "../ecs/Component";

export class PositionComponent extends Component {
  public x: number;
  public y: number;
  public chunkX: number;
  public chunkY: number;

  constructor(x: number = 0, y: number = 0) {
    super("position");
    this.x = x;
    this.y = y;
    this.chunkX = 0;
    this.chunkY = 0;
  }
}
