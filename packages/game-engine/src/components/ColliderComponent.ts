import { Component } from "../ecs/Component";

/**
 * Axis-aligned collision box centred on the entity's position, in pixels.
 */
export class ColliderComponent extends Component {
  public width: number;
  public height: number;
  public enabled: boolean;

  constructor(width: number, height: number, enabled: boolean = true) {
    super("collider");
    this.width = width;
    this.height = height;
    this.enabled = enabled;
  }
}
