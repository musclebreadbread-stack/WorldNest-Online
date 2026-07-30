import { Component } from "../ecs/Component";

export class NetworkComponent extends Component {
  public lastSync: number;
  public dirty: boolean;

  constructor() {
    super("network");
    this.lastSync = 0;
    this.dirty = false;
  }
}
