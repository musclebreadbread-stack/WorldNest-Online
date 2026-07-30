import { Component } from "./Component";

/**
 * Entity class for the ECS framework.
 * An entity is a unique ID with a collection of components.
 */
export class Entity {
  public readonly id: string;
  private components: Map<string, Component> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  addComponent(component: Component): this {
    this.components.set(component.type, component);
    return this;
  }

  removeComponent(type: string): this {
    this.components.delete(type);
    return this;
  }

  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  getComponents(): Component[] {
    return Array.from(this.components.values());
  }
}
