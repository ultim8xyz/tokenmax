"use client";

import { useEffect, useRef } from "react";
import { paintChart, paintWorld } from "@/lib/console/art";
import { denseDays, type DayRow } from "@/lib/console/board";

/** The member's world. Seeded from their name, so it is theirs and it is stable. */
export function World({ hue, seed, kind }: { hue: number; seed: number; kind: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => paintWorld(cv, hue, seed, 1.08, kind)),
    );
    return () => cancelAnimationFrame(raf);
  }, [hue, seed, kind]);
  return <canvas ref={ref} />;
}

/** Daily spend over the window. Takes the same shape the study's chart wanted. */
export function SpendChart({ days }: { days: DayRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const shaped = { days: denseDays(days) };
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => paintChart(cv, shaped)),
    );
    return () => cancelAnimationFrame(raf);
  }, [days]);
  return <canvas ref={ref} />;
}
