"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/**
 * A number that rolls to its new value instead of snapping.
 *
 * Only on change: the first render paints the value it was given, so a page
 * never counts up from zero on arrival. Reduced motion gets the number.
 */
/** Formatters live here by name: a function cannot cross from a server
 *  component into a client one, and passing one threw the whole render. */
const FORMATS = {
  usd0: (n: number) => "$" + Math.round(n).toLocaleString("en-US"),
  usd: (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  count: (n: number) => String(Math.round(n)),
} as const;

export function Rolling({
  value,
  format = "usd0",
  className,
}: {
  value: number;
  format?: keyof typeof FORMATS;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    if (value === from.current) return;

    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / DURATION_MS);
      // Decelerate: the last hundred pounds should land, not race past.
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(origin + (value - origin) * eased);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <span className={className}>{FORMATS[format](shown)}</span>;
}
