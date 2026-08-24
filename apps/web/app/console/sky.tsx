"use client";

import { useEffect, useRef } from "react";
import { rng, skyBed } from "@/lib/console/art";

/** The page's own starfield. Seeded, so it is the same sky on every load, and
 *  repainted rather than scaled on resize so the stars never smear. */
export function Sky({ hue = 210, seed = 7 }: { hue?: number; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    function fit() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const c = canvas.getContext("2d");
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      skyBed(c, w, h, hue, rng(seed));
    }

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [hue, seed]);

  return <canvas id="sky" ref={ref} aria-hidden="true" />;
}
