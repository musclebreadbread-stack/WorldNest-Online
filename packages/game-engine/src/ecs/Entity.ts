import { Component } from "./Component";

/**
 * Callback interface for notifying the World when an entity's components change.
 */
export interface EntityChangeListener {
  invalidateQueryCache(): void;
}

/**
 * Entity class for the ECS framework.
 * An entity is a unique ID with a collection of components.
 *
 * When registered with a World, component additions and removals automatically
 * invalidate the World's query cache to prevent stale results.
 */
export class Entity {
  public readonly id: string;
  private components: Map<string, Component> = new Map();
  private changeListener: EntityChangeListener | null = null;

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Set the change listener (typically the World that owns this entity).
   * Called internally by World.addEntity / World.removeEntity.
   */
  setChangeListener(listener: EntityChangeListener | null): void {
    this.changeListener = listener;
  }

  addComponent(component: Component): this {
    this.components.set(component.type, component);
    this.changeListener?.invalidateQueryCache();
    return this;
  }

  removeComponent(type: string): this {
    this.components.delete(type);
    this.changeListener?.invalidateQueryCache();
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
