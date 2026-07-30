import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { MovementSystem } from "../systems/MovementSystem";

describe("MovementSystem", () => {
  it("should apply velocity to position", () => {
    const system = new MovementSystem();
    const entity = new Entity("player");

    const position = new PositionComponent(100, 100);
    const velocity = new VelocityComponent(200, 0);

    entity.addComponent(position).addComponent(velocity);

    // Simulate 1 second
    system.update([entity], 1.0);

    expect(position.x).toBe(300);
    expect(position.y).toBe(100);
  });

  it("should apply velocity scaled by deltaTime", () => {
    const system = new MovementSystem();
    const entity = new Entity("player");

    const position = new PositionComponent(0, 0);
    const velocity = new VelocityComponent(100, 50);

    entity.addComponent(position).addComponent(velocity);

    // Simulate 0.5 seconds
    system.update([entity], 0.5);

    expect(position.x).toBe(50);
    expect(position.y).toBe(25);
  });

  it("should handle negative velocity (moving left/up)", () => {
    const system = new MovementSystem();
    const entity = new Entity("player");

    const position = new PositionComponent(200, 200);
    const velocity = new VelocityComponent(-100, -100);

    entity.addComponent(position).addComponent(velocity);

    system.update([entity], 1.0);

    expect(position.x).toBe(100);
    expect(position.y).toBe(100);
  });

  it("should update chunk coordinates based on position", () => {
    const system = new MovementSystem();
    const entity = new Entity("player");

    // Position in chunk (1, 1) = at pixel (512 + x, 512 + y) where chunk size is 16*32=512
    const position = new PositionComponent(600, 600);
    const velocity = new VelocityComponent(0, 0);

    entity.addComponent(position).addComponent(velocity);

    system.update([entity], 0.016);

    // 600 / (16 * 32) = 600 / 512 = 1.17 -> floor = 1
    expect(position.chunkX).toBe(1);
    expect(position.chunkY).toBe(1);
  });

  it("should handle zero velocity (no movement)", () => {
    const system = new MovementSystem();
    const entity = new Entity("player");

    const position = new PositionComponent(50, 50);
    const velocity = new VelocityComponent(0, 0);

    entity.addComponent(position).addComponent(velocity);

    system.update([entity], 1.0);

    expect(position.x).toBe(50);
    expect(position.y).toBe(50);
  });

  it("should update multiple entities", () => {
    const system = new MovementSystem();

    const entity1 = new Entity("e1");
    const pos1 = new PositionComponent(0, 0);
    entity1.addComponent(pos1).addComponent(new VelocityComponent(100, 0));

    const entity2 = new Entity("e2");
    const pos2 = new PositionComponent(0, 0);
    entity2.addComponent(pos2).addComponent(new VelocityComponent(0, 100));

    system.update([entity1, entity2], 1.0);

    expect(pos1.x).toBe(100);
    expect(pos1.y).toBe(0);
    expect(pos2.x).toBe(0);
    expect(pos2.y).toBe(100);
  });

  it("should only match entities with position and velocity", () => {
    const system = new MovementSystem();

    const entityWithBoth = new Entity("full");
    entityWithBoth.addComponent(new PositionComponent(0, 0));
    entityWithBoth.addComponent(new VelocityComponent(1, 1));

    const entityOnlyPos = new Entity("partial");
    entityOnlyPos.addComponent(new PositionComponent(0, 0));

    expect(system.matches(entityWithBoth)).toBe(true);
    expect(system.matches(entityOnlyPos)).toBe(false);
  });
});
