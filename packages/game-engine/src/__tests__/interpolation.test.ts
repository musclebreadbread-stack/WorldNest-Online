import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { PositionComponent } from "../components/PositionComponent";
import { RemoteInterpolationComponent } from "../components/RemoteInterpolationComponent";
import { InterpolationSystem } from "../systems/InterpolationSystem";

function createRemoteEntity(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  lerpFactor = 0.2,
): { entity: Entity; position: PositionComponent } {
  const entity = new Entity("remote");
  const position = new PositionComponent(x, y);
  entity
    .addComponent(position)
    .addComponent(new RemoteInterpolationComponent(targetX, targetY, lerpFactor));
  return { entity, position };
}

describe("InterpolationSystem", () => {
  it("should only match entities with position and remoteInterpolation", () => {
    const system = new InterpolationSystem();
    const { entity } = createRemoteEntity(0, 0, 100, 100);

    const positionOnly = new Entity("local");
    positionOnly.addComponent(new PositionComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(positionOnly)).toBe(false);
  });

  it("should converge monotonically toward the target", () => {
    const system = new InterpolationSystem();
    const { entity, position } = createRemoteEntity(0, 0, 1000, 2000);

    let previousDistance = Number.POSITIVE_INFINITY;

    for (let step = 0; step < 20; step++) {
      system.update([entity], 1 / 60);
      const distance = Math.hypot(1000 - position.x, 2000 - position.y);
      expect(distance).toBeLessThan(previousDistance);
      previousDistance = distance;
    }

    // Keep stepping until the remainder snaps to the target
    for (let step = 0; step < 60; step++) {
      system.update([entity], 1 / 60);
    }

    expect(position.x).toBe(1000);
    expect(position.y).toBe(2000);
  });

  it("should be a no-op when already at the target", () => {
    const system = new InterpolationSystem();
    const { entity, position } = createRemoteEntity(64, 96, 64, 96);

    system.update([entity], 1 / 60);

    expect(position.x).toBe(64);
    expect(position.y).toBe(96);
  });

  it("should snap to the target when within half a pixel", () => {
    const system = new InterpolationSystem();
    const { entity, position } = createRemoteEntity(99.7, 200, 100, 200);

    system.update([entity], 1 / 60);

    expect(position.x).toBe(100);
  });

  it("should be frame-rate independent", () => {
    const system = new InterpolationSystem();
    const slow = createRemoteEntity(0, 0, 1000, 1000);
    const fast = createRemoteEntity(0, 0, 1000, 1000);

    // One 1/30 s step against two 1/60 s steps
    system.update([slow.entity], 1 / 30);
    system.update([fast.entity], 1 / 60);
    system.update([fast.entity], 1 / 60);

    expect(Math.abs(slow.position.x - fast.position.x)).toBeLessThan(1);
    expect(Math.abs(slow.position.y - fast.position.y)).toBeLessThan(1);
  });

  it("should default to a lerp factor of 0.2", () => {
    const interpolation = new RemoteInterpolationComponent();

    expect(interpolation.lerpFactor).toBe(0.2);
    expect(interpolation.type).toBe("remoteInterpolation");
  });
});
