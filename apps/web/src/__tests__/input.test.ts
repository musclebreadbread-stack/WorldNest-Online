import { describe, it, expect, beforeEach } from "vitest";
import { TOUCH_DEADZONE, mergeInput, type KeyState } from "../game/inputMerge";
import { useTouchStore } from "../stores/touchStore";

const IDLE: KeyState = { up: false, down: false, left: false, right: false };

describe("mergeInput", () => {
  it("should produce no movement for an axis inside the deadzone", () => {
    expect(mergeInput(IDLE, 0, 0, TOUCH_DEADZONE)).toEqual(IDLE);
    expect(mergeInput(IDLE, 0.2, -0.2, TOUCH_DEADZONE)).toEqual(IDLE);
    // Exactly on the boundary still counts as centred
    expect(mergeInput(IDLE, TOUCH_DEADZONE, TOUCH_DEADZONE, TOUCH_DEADZONE)).toEqual(
      IDLE,
    );
  });

  it("should map each cardinal push to one key", () => {
    expect(mergeInput(IDLE, 0, -1, TOUCH_DEADZONE)).toEqual({ ...IDLE, up: true });
    expect(mergeInput(IDLE, 0, 1, TOUCH_DEADZONE)).toEqual({ ...IDLE, down: true });
    expect(mergeInput(IDLE, -1, 0, TOUCH_DEADZONE)).toEqual({ ...IDLE, left: true });
    expect(mergeInput(IDLE, 1, 0, TOUCH_DEADZONE)).toEqual({ ...IDLE, right: true });
  });

  it("should set two keys for a diagonal push", () => {
    expect(mergeInput(IDLE, 0.7, -0.7, TOUCH_DEADZONE)).toEqual({
      up: true,
      down: false,
      left: false,
      right: true,
    });
  });

  it("should let the keyboard win outright while any key is held", () => {
    const held: KeyState = { ...IDLE, left: true };

    // OR-ing the axis in would set left and right together, which cancels to a
    // standstill — the keyboard is authoritative instead.
    expect(mergeInput(held, 1, 0, TOUCH_DEADZONE)).toEqual(held);
    expect(mergeInput(held, 0, 1, TOUCH_DEADZONE)).toEqual(held);
  });

  it("should not mutate the key state it was given", () => {
    const keys: KeyState = { ...IDLE, up: true };

    const merged = mergeInput(keys, 1, 0, TOUCH_DEADZONE);

    expect(merged).not.toBe(keys);
    expect(keys).toEqual({ ...IDLE, up: true });
  });

  it("should honour a custom deadzone", () => {
    expect(mergeInput(IDLE, 0.1, 0, 0.05)).toEqual({ ...IDLE, right: true });
    expect(mergeInput(IDLE, 0.6, 0, 0.9)).toEqual(IDLE);
  });
});

describe("touchStore", () => {
  beforeEach(() => {
    useTouchStore.setState({
      active: false,
      axisX: 0,
      axisY: 0,
      interactRequested: false,
      buildRequested: false,
    });
  });

  it("should become active while the stick is off centre", () => {
    useTouchStore.getState().setAxis(0, -0.8);

    let state = useTouchStore.getState();
    expect(state.active).toBe(true);
    expect(state.axisY).toBe(-0.8);

    useTouchStore.getState().setAxis(0, 0);

    state = useTouchStore.getState();
    expect(state.active).toBe(false);
    expect(state.axisX).toBe(0);
  });

  it("should raise each one-shot flag on request", () => {
    useTouchStore.getState().requestInteract();
    expect(useTouchStore.getState().interactRequested).toBe(true);

    useTouchStore.getState().requestBuild();
    expect(useTouchStore.getState().buildRequested).toBe(true);
  });

  it("should fire exactly once per tap", () => {
    useTouchStore.getState().requestInteract();

    expect(useTouchStore.getState().consumeRequests()).toEqual({
      interact: true,
      build: false,
    });
    // The next frame must see nothing, or one tap would harvest every frame
    expect(useTouchStore.getState().consumeRequests()).toEqual({
      interact: false,
      build: false,
    });
    expect(useTouchStore.getState().interactRequested).toBe(false);
  });

  it("should consume both flags together", () => {
    useTouchStore.getState().requestInteract();
    useTouchStore.getState().requestBuild();

    expect(useTouchStore.getState().consumeRequests()).toEqual({
      interact: true,
      build: true,
    });
    expect(useTouchStore.getState().buildRequested).toBe(false);
  });

  it("should leave the axis alone when consuming requests", () => {
    useTouchStore.getState().setAxis(-1, 0);
    useTouchStore.getState().requestBuild();

    useTouchStore.getState().consumeRequests();

    const state = useTouchStore.getState();
    expect(state.axisX).toBe(-1);
    expect(state.active).toBe(true);
  });
});
