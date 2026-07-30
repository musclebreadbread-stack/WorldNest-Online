import { Component } from "../ecs/Component";

export class SpriteComponent extends Component {
  public textureKey: string;
  public frame: number;
  public visible: boolean;

  constructor(textureKey: string, frame: number = 0, visible: boolean = true) {
    super("sprite");
    this.textureKey = textureKey;
    this.frame = frame;
    this.visible = visible;
  }
}
