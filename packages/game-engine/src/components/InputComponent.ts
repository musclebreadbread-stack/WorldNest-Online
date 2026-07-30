import { Component } from "../ecs/Component";

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export class InputComponent extends Component {
  public keys: KeyState;

  constructor() {
    super("input");
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
  }
}
