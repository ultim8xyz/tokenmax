"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { paintChart, paintWorld } from "@/lib/console/art";
import { denseDays, usd, type DayRow } from "@/lib/console/board";

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
export function SpendChart({ days, hue }: { days: DayRow[]; hue: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  // Memoised so the observer is not torn down and rebuilt on every pointer move.
  const series = useMemo(() => denseDays(days), [days]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const paint = () => {
      if (cv.clientWidth === 0 || cv.clientHeight === 0) return;
      // paintChart draws in the member's hue; without it every colour stop
      // reads "hsla(undefined, ...)" and the canvas throws.
      paintChart(cv, { days: series, hue });
    };

    const observer = new ResizeObserver(paint);
    observer.observe(cv);
    paint();
    return () => observer.disconnect();
  }, [series, hue]);

  function track(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / Math.max(1, box.width);
    const i = Math.min(series.length - 1, Math.max(0, Math.round(ratio * (series.length - 1))));
    // The label follows the cursor; only the reading snaps to a day. Pinning
    // the label to the day made it lurch between columns.
    setHover({
      x: Math.min(box.width, Math.max(0, event.clientX - box.left)),
      // Read off the series rather than recomputing: a fresh `new Date()` on
      // every pointer move disagrees with the memoised series once the clock
      // crosses midnight, and the axis label would say otherwise.
      date: series[i]?.date ?? "",
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
