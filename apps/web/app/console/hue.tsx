"use client";

import { useEffect, useRef } from "react";

/** How much of the remaining distance is closed each frame. */
const EASE = 0.085;

let target = 210;
let current = 210;
let running = false;

function loop() {
  // Go the short way round the wheel, or a jump from 350 to 10 sweeps the
  // entire spectrum on screen.
  const d = ((target - current + 540) % 360) - 180;
  current += d * EASE;
  document.documentElement.style.setProperty("--hue", current.toFixed(1));
  requestAnimationFrame(loop);
}

/** Point the room at a hue. Safe to call on every pointer move. */
export function setHue(hue: number) {
  target = hue;
}

/**
 * The page's colour, lerped rather than switched.
 *
 * `--hue` drives the wash behind everything, so easing it is what makes moving
 * between members feel like moving through a room instead of a re-render.
 */
export function HueDrift({ hue }: { hue: number }) {
  const started = useRef(false);

  useEffect(() => {
    setHue(hue);
    if (running || started.current) return;
    running = true;
    started.current = true;
    // First frame straight to the target, so a cold load is not a fade-in.
    current = hue;
    document.documentElement.style.setProperty("--hue", String(hue));
    requestAnimationFrame(loop);
  }, [hue]);

  return null;
}
