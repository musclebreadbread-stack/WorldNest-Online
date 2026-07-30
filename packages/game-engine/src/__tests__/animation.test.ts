import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import {
  AnimationComponent,
  DEFAULT_FRAME_COUNT,
  DEFAULT_FRAME_DURATION_MS,
} from "../components/AnimationComponent";
import { PositionComponent } from "../components/PositionComponent";
import { RemoteInterpolationComponent } from "../components/RemoteInterpolationComponent";
import { SpriteComponent } from "../components/SpriteComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { AnimationSystem } from "../systems/AnimationSystem";
import { InterpolationSystem } from "../systems/InterpolationSystem";
import { directionFromDelta, directionalTextureKey } from "../animation/animationOps";

function createAnimatedEntity(vx: number, vy: number) {
  const entity = new Entity("player");
  const velocity = new VelocityComponent(vx, vy);
  const animation = new AnimationComponent();
  const sprite = new SpriteComponent("player");
  entity.addComponent(velocity).addComponent(animation).addComponent(sprite);
  return { entity, velocity, animation, sprite };
}

/** One frame at 60 fps, in seconds. */
const FRAME = 1 / 60;

describe("AnimationComponent", () => {
  it("should start idle facing down on frame zero", () => {
    const animation = new AnimationComponent();

    expect(animation.type).toBe("animation");
    expect(animation.state).toBe("idle");
    expect(animation.direction).toBe("down");
    expect(animation.frameIndex).toBe(0);
    expect(animation.frameDurationMs).toBe(DEFAULT_FRAME_DURATION_MS);
    expect(animation.frameCount).toBe(DEFAULT_FRAME_COUNT);
  });
});

describe("directionFromDelta", () => {
  it("should pick the dominant axis and report null when still", () => {
    expect(directionFromDelta(0, 0)).toBeNull();
    expect(directionFromDelta(5, 1)).toBe("right");
    expect(directionFromDelta(-5, 1)).toBe("left");
    expect(directionFromDelta(1, 5)).toBe("down");
    expect(directionFromDelta(1, -5)).toBe("up");
  });

  it("should break a tie in favour of the vertical direction", () => {
    expect(directionFromDelta(4, 4)).toBe("down");
    expect(directionFromDelta(-4, -4)).toBe("up");
  });
});

describe("directionalTextureKey", () => {
  it("should build the spritesheet key the boot textures are generated under", () => {
    expect(directionalTextureKey("player", "left", 1)).toBe("player_left_1");
  });
});

describe("AnimationSystem", () => {
  it("should only match entities with velocity, animation and sprite", () => {
    const system = new AnimationSystem();
    const { entity } = createAnimatedEntity(0, 0);

    const spriteOnly = new Entity("prop");
    spriteOnly.addComponent(new SpriteComponent("player"));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(spriteOnly)).toBe(false);
  });

  it("should stay idle on frame zero at zero velocity", () => {
    const system = new AnimationSystem();
    const { entity, animation, sprite } = createAnimatedEntity(0, 0);

    for (let frame = 0; frame < 30; frame++) {
      system.update([entity], FRAME);
    }

    expect(animation.state).toBe("idle");
    expect(animation.frameIndex).toBe(0);
    expect(sprite.frame).toBe(0);
  });

  it("should derive the direction from the dominant velocity axis", () => {
    const system = new AnimationSystem();
    const { entity, velocity, animation } = createAnimatedEntity(-200, 20);

    system.update([entity], FRAME);
    expect(animation.state).toBe("walk");
    expect(animation.direction).toBe("left");

    velocity.vx = 0;
    velocity.vy = -200;
    system.update([entity], FRAME);
    expect(animation.direction).toBe("up");
  });

  it("should advance a frame only once the frame duration has elapsed", () => {
    const system = new AnimationSystem();
    const { entity, animation, sprite } = createAnimatedEntity(200, 0);
    const almost = (animation.frameDurationMs - 1) / 1000;

    system.update([entity], almost);
    expect(animation.frameIndex).toBe(0);
    expect(sprite.frame).toBe(0);

    system.update([entity], 2 / 1000);
    expect(animation.frameIndex).toBe(1);
    expect(sprite.frame).toBe(1);
  });

  it("should cycle deterministically given fixed deltas", () => {
    const system = new AnimationSystem();
    const first = createAnimatedEntity(200, 0);
    const second = createAnimatedEntity(200, 0);

    for (let frame = 0; frame < 120; frame++) {
      system.update([first.entity], FRAME);
      system.update([second.entity], FRAME);
    }

    expect(first.animation.frameIndex).toBe(second.animation.frameIndex);
    expect(first.animation.elapsed).toBeCloseTo(second.animation.elapsed);
    // 120 frames at 60 fps is 2000 ms, which is 12 full 160 ms frames plus 80 ms
    expect(first.animation.frameIndex).toBe(12 % DEFAULT_FRAME_COUNT);
  });

  it("should keep the last direction but reset the cycle when movement stops", () => {
    const system = new AnimationSystem();
    const { entity, velocity, animation } = createAnimatedEntity(200, 0);

    system.update([entity], animation.frameDurationMs / 1000);
    expect(animation.frameIndex).toBe(1);

    velocity.vx = 0;
    system.update([entity], FRAME);

    expect(animation.state).toBe("idle");
    expect(animation.direction).toBe("right");
    expect(animation.frameIndex).toBe(0);
    expect(animation.elapsed).toBe(0);
  });
});

describe("InterpolationSystem animation", () => {
  it("should animate a remote entity from the distance it was moved", () => {
    const system = new InterpolationSystem();
    const entity = new Entity("remote-1");
    const animation = new AnimationComponent();
    const sprite = new SpriteComponent("player");
    entity
      .addComponent(new PositionComponent(0, 0))
      .addComponent(new RemoteInterpolationComponent(1000, 0))
      .addComponent(animation)
      .addComponent(sprite);

    system.update([entity], DEFAULT_FRAME_DURATION_MS / 1000);

    expect(animation.state).toBe("walk");
    expect(animation.direction).toBe("right");
    expect(sprite.frame).toBe(1);
  });

  it("should idle a remote entity that has reached its target", () => {
    const system = new InterpolationSystem();
    const entity = new Entity("remote-2");
    const animation = new AnimationComponent("left");
    entity
      .addComponent(new PositionComponent(64, 64))
      .addComponent(new RemoteInterpolationComponent(64, 64))
      .addComponent(animation);

    system.update([entity], FRAME);

    expect(animation.state).toBe("idle");
    expect(animation.direction).toBe("left");
  });
});
