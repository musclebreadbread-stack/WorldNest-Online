/**
 * Base Component class for the ECS framework.
 * Components are pure data containers attached to entities.
 */
export abstract class Component {
  public readonly type: string;

  constructor(type: string) {
    this.type = type;
  }
}
