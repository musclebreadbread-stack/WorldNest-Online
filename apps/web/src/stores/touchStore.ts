import { create } from "zustand";

interface TouchState {
  /** Whether the virtual stick is currently being held. */
  active: boolean;
  /** Normalised stick axis, -1..1, with -Y being up as in screen space. */
  axisX: number;
  axisY: number;
  interactRequested: boolean;
  buildRequested: boolean;

  setAxis: (axisX: number, axisY: number) => void;
  requestInteract: () => void;
  requestBuild: () => void;
  /** Read and clear both one-shot flags. Called once per frame by the game. */
  consumeRequests: () => { interact: boolean; build: boolean };
}

/**
 * The virtual gamepad written by `TouchControls` and read by `PlayerController`.
 *
 * Touch input is DOM rather than Phaser (decision D11): the buttons get Tailwind
 * styling, 44 px targets and real `aria-label`s, and the input still funnels
 * through the one place Phase 2 established. The store is the seam — React only
 * ever writes an axis and two flags, exactly as `chatStore` only holds a sender.
 *
 * The flags are consumed rather than read so one tap fires exactly one action,
 * and `PlayerController` routes them through the same 250 ms cooldown the `E` and
 * `Q` keys use, so touch cannot outpace the keyboard.
 */
export const useTouchStore = create<TouchState>((set, get) => ({
  active: false,
  axisX: 0,
  axisY: 0,
  interactRequested: false,
  buildRequested: false,

  // `active` is derived rather than set separately, so releasing the stick can
  // never leave the store claiming a thumb is still down.
  setAxis: (axisX, axisY) => set({ axisX, axisY, active: axisX !== 0 || axisY !== 0 }),

  requestInteract: () => set({ interactRequested: true }),

  requestBuild: () => set({ buildRequested: true }),

  consumeRequests: () => {
    const { interactRequested, buildRequested } = get();
    if (interactRequested || buildRequested) {
      set({ interactRequested: false, buildRequested: false });
    }
    return { interact: interactRequested, build: buildRequested };
  },
}));
