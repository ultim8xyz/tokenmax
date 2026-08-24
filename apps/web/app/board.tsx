"use client";

import { useState } from "react";
import Link from "next/link";
import { maxDowntimeSeconds, type ActivityDay } from "@/lib/downtime";
import {
  WINDOWS,
  classOf,
  costPerKiloLine,
  dur,
  sparkline,
  streakOf,
  toks,
  total,
  usd,
  windowDays,
  type MemberRow,
  type WindowKey,
} from "@/lib/console/board";
import { setHue } from "./console/hue";

/**
 * The board, switched in the browser.
 *
 * All three windows are cut from the same thirty days, so the server has
 * nothing extra to give: making the switch a navigation meant two auth round
 * trips to re-render numbers already in the page.
 */
export function Board({ members, initial }: { members: MemberRow[]; initial: WindowKey }) {
  const [window, setWindow] = useState<WindowKey>(initial);

  function choose(key: WindowKey) {
    setWindow(key);
    // Keep the URL honest without handing the navigation to the server.
    globalThis.history?.replaceState(null, "", key === "7d" ? "/" : `/?w=${key}`);
  }

  const rows = members
    .map((m) => ({ m, t: total(windowDays(m.days, window)) }))
    .filter((r) => r.t.cost > 0)
    .sort((a, b) => b.t.cost - a.t.cost);

  const label = WINDOWS.find((x) => x.key === window)!.label.toLowerCase();

  return (
    <section className="view on" id="lineup">
      <div className="shelfhead rise" style={{ "--i": 0 } as React.CSSProperties}>
        <h1>Leaderboard</h1>
        <span className="sub">Ranked by spend · {label}</span>
        <div className="seg">
          {WINDOWS.map((x) => (
            <button
              key={x.key}
              onClick={() => choose(x.key)}
              aria-pressed={String(window === x.key) as "true" | "false"}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="board">
        <div className="bhead">
          <span>Rank</span>
          <span>Member</span>
          <span>Last 14</span>
          <span className="r">Tokens</span>
          <span className="r">Field</span>
          <span className="r">Streak</span>
          <span className="r">Quiet</span>
          <span className="r">$/1k ln</span>
          <span className="r">Spend</span>
        </div>

        <div className="brows">
          {rows.map(({ m, t }, i) => {
            const [name, note] = classOf(m.days);
            const spark = sparkline(m.days);
            const rate = costPerKiloLine(t.cost, t.linesAdded);
            return (
              <Link
                key={m.username}
                href={`/u/${m.username}`}
                className={`brow${i === 0 ? " top" : ""}`}
                style={{ "--th": m.hue } as React.CSSProperties}
                aria-label={`${m.username}, rank ${i + 1}, ${usd(t.cost)}`}
                onPointerEnter={() => setHue(m.hue)}
                onFocus={() => setHue(m.hue)}
              >
                <div className="rk">
                  <i />
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="who">
                  {m.avatarUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="pfp" src={m.avatarUrl} alt="" />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{m.displayName ?? m.username}</div>
                    <div className="kl">
                      {name} · {note}
                    </div>
                  </div>
                </div>
                <div className="spark">
                  {spark.map((cell, k) => (
                    <i key={k} className={cell.level} style={{ height: `${cell.height}%` }} />
                  ))}
                </div>
                <div className="fig dim">{toks(t.tokens)}</div>
                <div className="fig dim">{t.peak}</div>
                <div className="fig dim">{streakOf(m.days)}d</div>
                <div className="fig dim">
                  {dur(maxDowntimeSeconds(m.days as unknown as ActivityDay[]))}
                </div>
                <div className="fig dim">{rate === null ? "—" : usd(rate)}</div>
                <div className="fig spend">{usd(t.cost)}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pager">
        <span>
          {rows.length === 0
            ? "nothing logged in this window"
            : `${rows.length} member${rows.length === 1 ? "" : "s"} · all shown`}
        </span>
      </div>
    </section>
  );
}
