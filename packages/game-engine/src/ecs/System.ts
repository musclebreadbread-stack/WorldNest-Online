import { Entity } from "./Entity";

/**
 * Base System class for the ECS framework.
 * Systems contain the logic that operates on entities with specific components.
 */
export abstract class System {
  public readonly requiredComponents: string[];

  constructor(requiredComponents: string[]) {
    this.requiredComponents = requiredComponents;
  }

  /**
   * Check if an entity has all required components for this system
   */
  matches(entity: Entity): boolean {
    return this.requiredComponents.every((type) => entity.hasComponent(type));
  }

  /**
   * Update logic to be implemented by concrete systems
   */
  abstract update(entities: Entity[], deltaTime: number): void;
}
