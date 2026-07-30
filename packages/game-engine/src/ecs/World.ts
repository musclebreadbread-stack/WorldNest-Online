import { Entity } from "./Entity";
import { System } from "./System";
import type { EntityChangeListener } from "./Entity";

/**
 * Entity creation and removal handed to systems that spawn entities (planting,
 * building) so they can stay decoupled from the World itself.
 */
export type AddEntity = (entity: Entity) => void;
export type RemoveEntityById = (entityId: string) => void;

/**
 * World class for the ECS framework.
 * The world manages all entities and systems.
 * Uses query caching to avoid O(N*S) filtering every frame.
 * Implements EntityChangeListener so entities can notify the World
 * when their component set changes, automatically invalidating the cache.
 */
export class World implements EntityChangeListener {
  private entities: Map<string, Entity> = new Map();
  private systems: System[] = [];
  private queryCache: Map<System, Entity[]> = new Map();
  private queryCacheDirty = true;

  addEntity(entity: Entity): this {
    this.entities.set(entity.id, entity);
    entity.setChangeListener(this);
    this.invalidateQueryCache();
    return this;
  }

  removeEntity(id: string): this {
    const entity = this.entities.get(id);
    if (entity) {
      entity.setChangeListener(null);
    }
    this.entities.delete(id);
    this.invalidateQueryCache();
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
    this.invalidateQueryCache();
    return this;
  }

  /**
   * Invalidate the query cache. Call this when entities or their
   * components change in a way that affects system matching.
   */
  invalidateQueryCache(): void {
    this.queryCacheDirty = true;
  }

  private rebuildQueryCache(): void {
    const allEntities = this.getEntities();
    for (const system of this.systems) {
      this.queryCache.set(
        system,
        allEntities.filter((entity) => system.matches(entity)),
      );
    }
    this.queryCacheDirty = false;
  }

  /**
   * Update all systems with matching entities.
   * Uses cached queries to avoid filtering every frame.
   */
  update(deltaTime: number): void {
    if (this.queryCacheDirty) {
      this.rebuildQueryCache();
    }

    for (const system of this.systems) {
      const matchingEntities = this.queryCache.get(system) || [];
      system.update(matchingEntities, deltaTime);
    }
  }
}
