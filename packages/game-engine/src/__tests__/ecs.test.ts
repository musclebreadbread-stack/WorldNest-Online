import { describe, it, expect } from "vitest";
import { World } from "../ecs/World";
import { Entity } from "../ecs/Entity";
import { Component } from "../ecs/Component";
import { System } from "../ecs/System";

class TestComponent extends Component {
  public value: number;
  constructor(value: number = 0) {
    super("test");
    this.value = value;
  }
}

class AnotherComponent extends Component {
  public label: string;
  constructor(label: string = "default") {
    super("another");
    this.label = label;
  }
}

class TestSystem extends System {
  public updateCount = 0;
  public lastEntities: Entity[] = [];

  constructor() {
    super(["test"]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    this.updateCount++;
    this.lastEntities = entities;
    for (const entity of entities) {
      const comp = entity.getComponent<TestComponent>("test")!;
      comp.value += 1;
    }
  }
}

describe("Entity", () => {
  it("should create entity with id", () => {
    const entity = new Entity("player-1");
    expect(entity.id).toBe("player-1");
  });

  it("should add and retrieve components", () => {
    const entity = new Entity("e1");
    const comp = new TestComponent(42);

    entity.addComponent(comp);

    expect(entity.hasComponent("test")).toBe(true);
    expect(entity.getComponent<TestComponent>("test")?.value).toBe(42);
  });

  it("should remove components", () => {
    const entity = new Entity("e1");
    entity.addComponent(new TestComponent(10));

    entity.removeComponent("test");

    expect(entity.hasComponent("test")).toBe(false);
    expect(entity.getComponent("test")).toBeUndefined();
  });

  it("should return all components", () => {
    const entity = new Entity("e1");
    entity.addComponent(new TestComponent(1));
    entity.addComponent(new AnotherComponent("hello"));

    const components = entity.getComponents();
    expect(components).toHaveLength(2);
  });

  it("should support method chaining for addComponent", () => {
    const entity = new Entity("e1");
    const result = entity
      .addComponent(new TestComponent(1))
      .addComponent(new AnotherComponent("x"));

    expect(result).toBe(entity);
    expect(entity.hasComponent("test")).toBe(true);
    expect(entity.hasComponent("another")).toBe(true);
  });
});

describe("World", () => {
  it("should add and retrieve entities", () => {
    const world = new World();
    const entity = new Entity("e1");

    world.addEntity(entity);

    expect(world.getEntity("e1")).toBe(entity);
  });

  it("should remove entities", () => {
    const world = new World();
    const entity = new Entity("e1");
    world.addEntity(entity);

    world.removeEntity("e1");

    expect(world.getEntity("e1")).toBeUndefined();
  });

  it("should return all entities", () => {
    const world = new World();
    world.addEntity(new Entity("e1"));
    world.addEntity(new Entity("e2"));
    world.addEntity(new Entity("e3"));

    expect(world.getEntities()).toHaveLength(3);
  });

  it("should add systems and run update", () => {
    const world = new World();
    const system = new TestSystem();
    world.addSystem(system);

    const entity = new Entity("e1");
    entity.addComponent(new TestComponent(0));
    world.addEntity(entity);

    world.update(0.016);

    expect(system.updateCount).toBe(1);
    expect(entity.getComponent<TestComponent>("test")!.value).toBe(1);
  });

  it("should only pass matching entities to systems", () => {
    const world = new World();
    const system = new TestSystem(); // requires "test" component
    world.addSystem(system);

    const matching = new Entity("e1");
    matching.addComponent(new TestComponent(0));

    const nonMatching = new Entity("e2");
    nonMatching.addComponent(new AnotherComponent("hi"));

    world.addEntity(matching);
    world.addEntity(nonMatching);

    world.update(0.016);

    expect(system.lastEntities).toHaveLength(1);
    expect(system.lastEntities[0].id).toBe("e1");
  });

  it("should invalidate query cache when entities are added", () => {
    const world = new World();
    const system = new TestSystem();
    world.addSystem(system);

    const e1 = new Entity("e1");
    e1.addComponent(new TestComponent(0));
    world.addEntity(e1);

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(1);

    // Add a second matching entity
    const e2 = new Entity("e2");
    e2.addComponent(new TestComponent(10));
    world.addEntity(e2);

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(2);
  });

  it("should invalidate query cache when entities are removed", () => {
    const world = new World();
    const system = new TestSystem();
    world.addSystem(system);

    const e1 = new Entity("e1");
    e1.addComponent(new TestComponent(0));
    const e2 = new Entity("e2");
    e2.addComponent(new TestComponent(5));

    world.addEntity(e1);
    world.addEntity(e2);

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(2);

    world.removeEntity("e1");

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(1);
    expect(system.lastEntities[0].id).toBe("e2");
  });

  it("should allow manual cache invalidation", () => {
    const world = new World();
    const system = new TestSystem();
    world.addSystem(system);

    const entity = new Entity("e1");
    world.addEntity(entity);

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(0);

    // Add component after entity is in world - auto-invalidation via change listener
    entity.addComponent(new TestComponent(0));

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(1);
  });

  it("should auto-invalidate cache when component is removed from live entity", () => {
    const world = new World();
    const system = new TestSystem();
    world.addSystem(system);

    const entity = new Entity("e1");
    entity.addComponent(new TestComponent(0));
    world.addEntity(entity);

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(1);

    // Remove component from a live entity - should auto-invalidate
    entity.removeComponent("test");

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(0);
  });

  it("should not notify after entity is removed from world", () => {
    const world = new World();
    const system = new TestSystem();
    world.addSystem(system);

    const entity = new Entity("e1");
    entity.addComponent(new TestComponent(0));
    world.addEntity(entity);

    world.update(0.016);
    expect(system.lastEntities).toHaveLength(1);

    // Remove entity from world, then add a component - should NOT invalidate
    world.removeEntity("e1");
    world.update(0.016);
    expect(system.lastEntities).toHaveLength(0);

    // Adding component to removed entity should not trigger invalidation
    entity.addComponent(new AnotherComponent("orphan"));
    // Cache should still be valid (not dirty) - next update should still show 0 entities
    world.update(0.016);
    expect(system.lastEntities).toHaveLength(0);
  });
});

describe("System", () => {
  it("should match entities with required components", () => {
    const system = new TestSystem(); // requires ["test"]
    const entity = new Entity("e1");
    entity.addComponent(new TestComponent(0));

    expect(system.matches(entity)).toBe(true);
  });

  it("should not match entities missing required components", () => {
    const system = new TestSystem(); // requires ["test"]
    const entity = new Entity("e1");
    entity.addComponent(new AnotherComponent("x"));

    expect(system.matches(entity)).toBe(false);
  });
});
