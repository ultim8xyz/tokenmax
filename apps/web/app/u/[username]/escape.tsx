"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Escape leaves a member page.
 *
 * A profile is a drill-down from the board, not a separate destination, so the
 * key people already press to back out of things backs out of this too. It goes
 * to the same place the card's visible `leaderboard` link goes: one behaviour,
 * two ways to reach it. `push` rather than `back` because a deep link or a
 * refresh has no board behind it to return to.
 *
 * Nothing here traps focus. The page is a page, so Tab walks off it normally.
 */
export function BackOnEscape({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      // Escape inside a field means "clear this", never "leave the page".
      const el = e.target as Element | null;
      if (
        el &&
        typeof el.closest === "function" &&
        el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      ) {
        return;
      }
      router.push(href);
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, href]);

  return null;
}
