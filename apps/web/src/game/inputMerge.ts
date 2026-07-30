import type { InputComponent } from "@worldnest/game-engine";

/** The four movement flags `MovementSystem` reads. */
export type KeyState = InputComponent["keys"];

/**
 * How far the thumb-stick must travel before it counts as a direction.
 *
 * Generous on purpose: a thumb resting on a phone screen wanders by a few pixels,
 * and a player who has to aim to stand still will conclude the game is broken.
 */
export const TOUCH_DEADZONE = 0.25;

/**
 * Combine the polled keyboard with the virtual stick.
 *
 * Pure, so the whole merge is testable without Phaser or a touchscreen — which
 * matters more than usual here, because Playwright cannot reach `/game` (the
 * middleware redirects an unauthenticated visitor to `/auth`) and there is no
 * touch device in the sandbox.
 *
 * The keyboard wins outright rather than being OR-ed in: a held `A` plus a stick
 * pushed right would set `left` and `right` together, which `MovementSystem`
 * resolves as standing still. Someone typing WASD while a stale axis sits in the
 * store would simply stop moving, and that is a much worse bug than the stick
 * being ignored for as long as a key is down.
 */
export function mergeInput(
  keys: KeyState,
  axisX: number,
  axisY: number,
  deadzone: number = TOUCH_DEADZONE,
): KeyState {
  if (keys.up || keys.down || keys.left || keys.right) {
    return { ...keys };
  }

  return {
    // Screen space: -Y is up, which is what the stick component reports
    up: axisY < -deadzone,
    down: axisY > deadzone,
    left: axisX < -deadzone,
    right: axisX > deadzone,
  };
}
