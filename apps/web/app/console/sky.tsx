"use client";

import { useEffect, useRef } from "react";
import { rng } from "@/lib/console/art";

/**
 * The ambient starfield, ported from the design study.
 *
 * Live, not a still: 190 stars drift across and twinkle out of phase, redrawn
 * every frame. Depth `z` drives drift rate, size and brightness together, so
 * the near ones move and the far ones hold.
 */
export function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;

    const rand = rng(4242);
    const stars = Array.from({ length: 190 }, () => ({
      x: rand(),
      y: rand(),
      z: 0.2 + rand() * 0.8,
      ph: rand() * Math.PI * 2,
    }));

    let W = 0;
    let H = 0;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = (t: number) => {
      c.clearRect(0, 0, W, H);
      for (const s of stars) {
        const drift = reduce ? 0 : t * 0.000012 * s.z;
        const x = ((s.x + drift) % 1) * W;
        const tw = reduce ? 0.7 : 0.55 + Math.sin(t * 0.0013 + s.ph) * 0.42;
        c.globalAlpha = Math.max(0, tw) * (0.24 + s.z * 0.5);
        c.fillStyle = "#dce8ff";
        const r = s.z * 1.35;
        c.fillRect(x, s.y * H, r, r);
      }
      c.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return <canvas id="sky" ref={ref} aria-hidden="true" />;
}
