import { Entity } from "./Entity";
import { System } from "./System";

/**
 * World class for the ECS framework.
 * The world manages all entities and systems.
 */
export class World {
  private entities: Map<string, Entity> = new Map();
  private systems: System[] = [];

  addEntity(entity: Entity): this {
    this.entities.set(entity.id, entity);
    return this;
  }

  removeEntity(id: string): this {
    this.entities.delete(id);
    return this;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  addSystem(system: System): this {
    this.systems.push(system);
    return this;
  }

  /**
   * Update all systems with matching entities
   */
  update(deltaTime: number): void {
    for (const system of this.systems) {
      const matchingEntities = this.getEntities().filter((entity) => system.matches(entity));
      system.update(matchingEntities, deltaTime);
    }
  }
}
