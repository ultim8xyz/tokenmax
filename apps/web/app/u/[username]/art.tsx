"use client";

import { useEffect, useRef, useState } from "react";
import { paintChart, paintWorld } from "@/lib/console/art";
import { denseDays, usd, type DayRow } from "@/lib/console/board";
import { isoDate, shiftDays } from "@/lib/streak";

/** The member's world. Seeded from their hue, so it is theirs and it is stable. */
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

interface Hover {
  x: number;
  date: string;
  cost: number;
}

/**
 * Daily spend over the window.
 *
 * Painted on a ResizeObserver rather than once on mount: the canvas measures
 * itself, and inside a grid it is still zero-sized on the frame React first
 * hands it over — which is why it drew nothing at all.
 */
export function SpendChart({ days }: { days: DayRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const series = denseDays(days);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const paint = () => {
      if (cv.clientWidth === 0 || cv.clientHeight === 0) return;
      paintChart(cv, { days: series });
    };

    const observer = new ResizeObserver(paint);
    observer.observe(cv);
    paint();
    return () => observer.disconnect();
  }, [series]);

  function track(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / Math.max(1, box.width);
    const i = Math.min(series.length - 1, Math.max(0, Math.round(ratio * (series.length - 1))));
    setHover({
      x: (i / (series.length - 1)) * box.width,
      date: isoDate(shiftDays(new Date(), i - (series.length - 1))),
      cost: series[i]?.cost ?? 0,
    });
  }

  return (
    <>
      <canvas ref={ref} />
      <div
        className="chart-hit"
        onPointerMove={track}
        onPointerLeave={() => setHover(null)}
        aria-hidden="true"
      />
      {hover && (
        <div className="chart-tip" style={{ left: `${hover.x}px` }}>
          <span className="d">{hover.date}</span>
          <span className="v">{usd(hover.cost)}</span>
        </div>
      )}
    </>
  );
}
