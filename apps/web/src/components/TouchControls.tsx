"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { useCoarsePointer } from "../hooks/useCoarsePointer";
import { useTouchStore } from "../stores/touchStore";
import { useUIStore } from "../stores/uiStore";

/** Pad diameter in pixels, and the fallback radius jsdom's zero-sized rect needs. */
const PAD_SIZE = 128;

/**
 * On-screen controls for touch devices (decision D11).
 *
 * DOM rather than drawn into the canvas, so the buttons get real `aria-label`s,
 * 44 px minimum targets and Tailwind's logical utilities — the whole set mirrors
 * in Arabic for free. Nothing here talks to the engine: the stick writes an axis
 * and the buttons raise a flag in `touchStore`, and `PlayerController` merges both
 * with the keyboard on the next frame.
 *
 * Rendered only for a coarse pointer, so a desktop player never loses a corner of
 * the screen to controls they cannot use.
 */
export function TouchControls() {
  const coarse = useCoarsePointer();
  const buildMode = useUIStore((s) => s.buildMode);
  const toggleBuildMode = useUIStore((s) => s.toggleBuildMode);
  const toggleInventory = useUIStore((s) => s.toggleInventory);
  const toggleMinimap = useUIStore((s) => s.toggleMinimap);
  const requestInteract = useTouchStore((s) => s.requestInteract);
  const requestBuild = useTouchStore((s) => s.requestBuild);
  const { t } = useTranslation();

  if (!coarse) return null;

  return (
    <div className="touch-safe-area pointer-events-none absolute inset-0">
      <div className="pointer-events-auto absolute bottom-36 start-4">
        <ThumbStick label={t("touch.stick")} />
      </div>

      <div className="pointer-events-auto absolute bottom-36 end-4 grid grid-cols-2 gap-2">
        <TouchButton glyph="E" label={t("touch.interact")} onPress={requestInteract} />
        {/* Placing is gated on build mode in the engine too, so the button is
            disabled rather than hidden and the layout never jumps. */}
        <TouchButton
          glyph="Q"
          label={t("touch.place")}
          onPress={requestBuild}
          disabled={!buildMode}
        />
        <TouchButton
          glyph="B"
          label={t("build.title")}
          onPress={toggleBuildMode}
          active={buildMode}
        />
        <TouchButton glyph="I" label={t("inventory.title")} onPress={toggleInventory} />
        <TouchButton glyph="M" label={t("touch.map")} onPress={toggleMinimap} />
      </div>
    </div>
  );
}

/**
 * A round pad whose thumb offset from the centre is the movement axis.
 *
 * The offset is normalised by the pad's radius and clamped to the unit circle, so
 * a diagonal push is never faster than a cardinal one.
 */
function ThumbStick({ label }: { label: string }) {
  const setAxis = useTouchStore((s) => s.setAxis);
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;

    const rect = pad.getBoundingClientRect();
    // jsdom reports a zero-sized rect, and so does a pad hidden mid-gesture
    const radius = (rect.width || PAD_SIZE) / 2;
    const axis = clampToUnitCircle(
      (event.clientX - (rect.left + rect.width / 2)) / radius,
      (event.clientY - (rect.top + rect.height / 2)) / radius,
    );

    setKnob({ x: axis.x * radius, y: axis.y * radius });
    setAxis(axis.x, axis.y);
  };

  const release = () => {
    setKnob({ x: 0, y: 0 });
    setAxis(0, 0);
  };

  return (
    <div
      ref={padRef}
      role="group"
      aria-label={label}
      style={{ width: PAD_SIZE, height: PAD_SIZE }}
      className="relative touch-none rounded-full border border-white/20 bg-black/40"
      onPointerDown={(event) => {
        // Capture keeps the gesture alive when the thumb slides off the pad
        if (typeof event.currentTarget.setPointerCapture === "function") {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        track(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0) return;

        track(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/70"
        style={{
          transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}

interface TouchButtonProps {
  /** The key this button stands in for, so the two control schemes teach each other. */
  glyph: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}

/**
 * One 56 px round button, comfortably over the 44 px minimum touch target.
 *
 * It fires on `pointerdown` rather than `click`, so tapping feels immediate and a
 * tap that ends with a slight drag still counts.
 */
function TouchButton({ glyph, label, onPress, disabled, active }: TouchButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      className={`h-14 w-14 touch-none rounded-full border text-sm font-semibold text-white transition-colors disabled:opacity-30 ${
        active ? "border-worldnest-primary bg-worldnest-primary/40" : "border-white/20 bg-black/50"
      }`}
    >
      {glyph}
    </button>
  );
}

/**
 * Keep a normalised offset inside the unit circle.
 *
 * Exported for the unit test: this is the whole reason a diagonal push does not
 * travel 1.41 times faster than a straight one.
 */
export function clampToUnitCircle(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length <= 1 || length === 0) return { x, y };

  return { x: x / length, y: y / length };
}
