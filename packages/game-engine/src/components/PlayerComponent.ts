import { Component } from "../ecs/Component";

export class PlayerComponent extends Component {
  public playerId: string;
  public username: string;
  public isLocal: boolean;

  constructor(playerId: string, username: string, isLocal: boolean = false) {
    super("player");
    this.playerId = playerId;
    this.username = username;
    this.isLocal = isLocal;
  }
}
