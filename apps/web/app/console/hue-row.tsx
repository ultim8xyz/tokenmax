"use client";

import Link from "next/link";
import { setHue } from "./hue";

/** A leaderboard row that pulls the room's colour toward its member. */
export function HueRow({
  href,
  hue,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  hue: number;
  className: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={{ "--th": hue } as React.CSSProperties}
      aria-label={ariaLabel}
      onPointerEnter={() => setHue(hue)}
      onFocus={() => setHue(hue)}
    >
      {children}
    </Link>
  );
}
