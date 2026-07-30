import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_LOCALE } from "../i18n";
import { en } from "../i18n/messages/en";
import { ko } from "../i18n/messages/ko";
import { TouchControls, clampToUnitCircle } from "../components/TouchControls";
import { useLocaleStore } from "../stores/localeStore";
import { useTouchStore } from "../stores/touchStore";
import { useUIStore } from "../stores/uiStore";

/**
 * `matchMedia` does not exist in jsdom, so every test installs one.
 *
 * The jsdom suite carries the whole weight of item 15: Playwright cannot reach
 * `/game` because `middleware.ts` redirects an unauthenticated visitor to
 * `/auth`, so there is no e2e coverage of these controls and no touch device in
 * the sandbox to try them on.
 */
function mockPointer(coarse: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: coarse && query.includes("coarse"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * jsdom's `getBoundingClientRect` is all zeros, which would make every offset
 * infinite. This pins a 128 px pad at the origin so the axis maths is real.
 */
function stubPadRect(size = 128): void {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size,
      bottom: size,
      width: size,
      height: size,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

const originalGetRect = Element.prototype.getBoundingClientRect;

describe("TouchControls", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
    useTouchStore.setState({
      active: false,
      axisX: 0,
      axisY: 0,
      interactRequested: false,
      buildRequested: false,
    });
    useUIStore.setState({ inventoryOpen: false, buildMode: false, minimapOpen: true });
    mockPointer(true);
    stubPadRect();
  });

  afterEach(() => {
    cleanup();
    Element.prototype.getBoundingClientRect = originalGetRect;
  });

  it("should render nothing for a fine pointer", () => {
    mockPointer(false);

    const { container } = render(<TouchControls />);

    expect(container.textContent).toBe("");
  });

  it("should render the stick and every action button for a coarse pointer", () => {
    render(<TouchControls />);

    expect(screen.getByLabelText(en["touch.stick"])).toBeDefined();
    expect(screen.getByLabelText(en["touch.interact"])).toBeDefined();
    expect(screen.getByLabelText(en["touch.place"])).toBeDefined();
    expect(screen.getByLabelText(en["build.title"])).toBeDefined();
    expect(screen.getByLabelText(en["inventory.title"])).toBeDefined();
    expect(screen.getByLabelText(en["touch.map"])).toBeDefined();
  });

  it("should write a normalised axis on pointer-down", () => {
    render(<TouchControls />);

    // The right edge of a 128 px pad centred at (64, 64)
    fireEvent.pointerDown(screen.getByLabelText(en["touch.stick"]), {
      clientX: 128,
      clientY: 64,
    });

    const state = useTouchStore.getState();
    expect(state.axisX).toBeCloseTo(1);
    expect(state.axisY).toBeCloseTo(0);
    expect(state.active).toBe(true);
  });

  it("should report up as a negative Y, matching screen space", () => {
    render(<TouchControls />);

    fireEvent.pointerDown(screen.getByLabelText(en["touch.stick"]), {
      clientX: 64,
      clientY: 0,
    });

    expect(useTouchStore.getState().axisY).toBeCloseTo(-1);
  });

  it("should clamp a corner drag to the unit circle", () => {
    render(<TouchControls />);

    // Bottom-right corner: offset (64, 64), length 1.41 before clamping
    fireEvent.pointerDown(screen.getByLabelText(en["touch.stick"]), {
      clientX: 128,
      clientY: 128,
    });

    const state = useTouchStore.getState();
    expect(Math.hypot(state.axisX, state.axisY)).toBeCloseTo(1);
  });

  it("should recentre the axis when the thumb lifts", () => {
    render(<TouchControls />);
    const stick = screen.getByLabelText(en["touch.stick"]);

    fireEvent.pointerDown(stick, { clientX: 128, clientY: 64 });
    expect(useTouchStore.getState().active).toBe(true);

    fireEvent.pointerUp(stick);

    const state = useTouchStore.getState();
    expect(state.axisX).toBe(0);
    expect(state.axisY).toBe(0);
    expect(state.active).toBe(false);
  });

  it("should ignore a pointer move with no button held", () => {
    render(<TouchControls />);

    fireEvent.pointerMove(screen.getByLabelText(en["touch.stick"]), {
      clientX: 128,
      clientY: 64,
      buttons: 0,
    });

    expect(useTouchStore.getState().active).toBe(false);
  });

  it("should raise the interact flag without bypassing the cooldown", () => {
    render(<TouchControls />);

    fireEvent.pointerDown(screen.getByLabelText(en["touch.interact"]));

    // The flag is all the component does; `PlayerController` consumes it through
    // the same 250 ms gate the `E` key uses.
    expect(useTouchStore.getState().interactRequested).toBe(true);
  });

  it("should disable the place button until build mode is on", () => {
    render(<TouchControls />);

    const place = screen.getByLabelText(en["touch.place"]) as HTMLButtonElement;
    expect(place.disabled).toBe(true);

    fireEvent.pointerDown(screen.getByLabelText(en["build.title"]));

    expect(useUIStore.getState().buildMode).toBe(true);
    expect(
      (screen.getByLabelText(en["touch.place"]) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("should raise the build flag once build mode is on", () => {
    useUIStore.setState({ buildMode: true });
    render(<TouchControls />);

    fireEvent.pointerDown(screen.getByLabelText(en["touch.place"]));

    expect(useTouchStore.getState().buildRequested).toBe(true);
  });

  it("should toggle the inventory and the minimap through the UI store", () => {
    render(<TouchControls />);

    fireEvent.pointerDown(screen.getByLabelText(en["inventory.title"]));
    fireEvent.pointerDown(screen.getByLabelText(en["touch.map"]));

    const state = useUIStore.getState();
    expect(state.inventoryOpen).toBe(true);
    expect(state.minimapOpen).toBe(false);
  });

  it("should label the controls in the chosen language", () => {
    useLocaleStore.setState({ locale: "ko", hydrated: true });

    render(<TouchControls />);

    expect(screen.getByLabelText(ko["touch.stick"])).toBeDefined();
    expect(screen.getByLabelText(ko["touch.interact"])).toBeDefined();
  });
});

describe("clampToUnitCircle", () => {
  it("should leave a vector inside the circle alone", () => {
    expect(clampToUnitCircle(0, 0)).toEqual({ x: 0, y: 0 });
    expect(clampToUnitCircle(0.5, -0.5)).toEqual({ x: 0.5, y: -0.5 });
  });

  it("should scale a longer vector back to length one", () => {
    const clamped = clampToUnitCircle(3, 4);

    expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(1);
    expect(clamped.x).toBeCloseTo(0.6);
    expect(clamped.y).toBeCloseTo(0.8);
  });
});
