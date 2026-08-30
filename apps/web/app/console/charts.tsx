"use client";

import { useState } from "react";
import { usd, usd0 } from "@/lib/console/board";

/**
 * The plate's instruments. Both the board and a member page read the same
 * numbers, so they draw them with the same parts rather than with two
 * implementations that drift.
 */

/** Density ramp for the register. An idle day prints, so gaps stay countable. */
const RAMP = [".", "░", "▒", "▓", "█"];

/** The gauge is scaled past the worst reading so the needle never pins. */
const GAUGE_MAX = 120;

/** Rounded, or the server and the client disagree on the last float digit and
 *  React calls that a hydration mismatch. */
const r2 = (n: number) => Number(n.toFixed(2));

export interface Needle {
  user: string;
  rate: number;
  lit: boolean;
}

function Dial({ needles }: { needles: Needle[] }) {
  const CX = 150;
  const CY = 132;
  const R = 104;
  const angle = (v: number) => Math.PI - Math.PI * Math.min(1, Math.max(0, v) / GAUGE_MAX);
  const at = (v: number, r = R) => {
    const a = angle(v);
    return [r2(CX + Math.cos(a) * r), r2(CY - Math.sin(a) * r)] as const;
  };
  const arc = (v0: number, v1: number, r: number) => {
    const [x0, y0] = at(v0, r);
    const [x1, y1] = at(v1, r);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };

  const lit = needles.find((n) => n.lit) ?? needles[0];

  const ticks = [];
  for (let v = 0; v <= GAUGE_MAX; v += 5) {
    const maj = v % 30 === 0;
    const mid = v % 10 === 0;
    const [x1, y1] = at(v, R - (maj ? 13 : mid ? 8 : 5));
    const [x2, y2] = at(v);
    ticks.push(
      <line
        key={`t${v}`}
        className={`tick${maj ? " maj" : mid ? " mid" : ""}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
      />,
    );
    if (maj) {
      const [lx, ly] = at(v, R - 27);
      ticks.push(
        <text key={`l${v}`} className="lbl" textAnchor="middle" x={lx} y={ly + 3}>
          {v}
        </text>,
      );
    }
  }

  return (
    <svg viewBox="0 12 300 150" aria-hidden="true">
      {/* the full travel, then the part of it actually used */}
      <path className="arc" d={arc(0, GAUGE_MAX, R)} />
      {lit && <path className="band" d={arc(0, lit.rate, R - 3.5)} />}
      {ticks}
      {needles.map((n) => {
        const [x, y] = at(n.rate, R - 16);
        const [bx, by] = at(n.rate, -14);
        return <line key={n.user} className={n.lit ? "needle" : "ghost"} x1={bx} y1={by} x2={x} y2={y} />;
      })}
      <circle className="hub" cx={CX} cy={CY} r={4.5} />
      <circle className="hub-in" cx={CX} cy={CY} r={1.5} />
      <text className="cap" x={at(0, R - 27)[0]} y={CY + 17} textAnchor="middle">
        efficient
      </text>
      <text className="cap" x={at(GAUGE_MAX, R - 27)[0]} y={CY + 17} textAnchor="middle">
        wasteful
      </text>
    </svg>
  );
}

/**
 * The one glass surface. Everything else on the plate is matte, which is what
 * makes this read as the reading that matters rather than as decoration.
 */
export function GaugePanel({
  hue,
  rates,
  note,
}: {
  hue: number;
  rates: { user: string; rate: number }[];
  note?: string;
}) {
  const best = rates[0] ?? null;
  return (
    <div className="gauge" style={{ "--th": hue } as React.CSSProperties}>
      <span className="glass" aria-hidden="true" />
      <div className="gin">
        <div className="k">
          cost per 1,000 lines<span className="u">usd</span>
        </div>
        <Dial needles={rates.map((r) => ({ ...r, lit: r.user === best?.user }))} />
        <div className="read">
          <b>{best ? usd(best.rate) : "—"}</b>
          <span>{best ? (note ?? best.user) : "no lines counted yet"}</span>
        </div>
        {rates.length > 1 && (
          <div className="legend">
            {rates.map((r) => (
              <span key={r.user} className={r.user === best?.user ? "" : "g"}>
                <i />
                {r.user} {usd(r.rate)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Thirty days as monospace glyphs, one cell per day. An idle day prints as a
 * dot, so the gaps stay countable — which is exactly what a smoothed curve
 * hides.
 */
export function Register({ days, label }: { days: { date: string; cost: number }[]; label?: string }) {
  const peak = Math.max(1, ...days.map((d) => d.cost));
  return (
    <div className="ascii">
      <div className="k">
        {label ?? "daily spend register"}
        <span className="u">30d · · ░ ▒ ▓ █</span>
      </div>
      <div className="glyphs">
        {days.map((d, k) => (
          <i
            key={d.date}
            data-off={d.cost === 0 ? "" : undefined}
            data-now={k === days.length - 1 ? "" : undefined}
            title={`${d.date} · ${d.cost === 0 ? "no activity" : usd(d.cost)}`}
          >
            {d.cost === 0 ? RAMP[0] : RAMP[Math.min(4, Math.floor((d.cost / peak) * 4.999))]}
          </i>
        ))}
      </div>
      <div className="scale">
        <span>{days[0]?.date}</span>
        <span>{days[days.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export interface Series {
  user: string;
  costs: number[];
  lit: boolean;
}

/**
 * Daily spend, sampled and held. A strip chart, not a curve: a day is a flat
 * step because a day is a bucket, and smoothing between the samples invents
 * readings that were never taken.
 */
export function Scope({ series, dates }: { series: Series[]; dates: string[] }) {
  const [at, setAt] = useState<number | null>(null);

  const W = 1000;
  const H = 252;
  const L = 64;
  const RGT = 14;
  const T = 26;
  const B = 44;
  const plotW = W - L - RGT;
  const plotH = H - T - B;
  const n = Math.max(1, dates.length);

  const raw = Math.max(1, ...series.flatMap((s) => s.costs));
  // Round the ceiling up to something a person would actually label.
  const step = 10 ** Math.floor(Math.log10(raw));
  const peak = Math.ceil(raw / step) * step;

  const bw = plotW / n;
  const x = (i: number) => r2(L + (i / n) * plotW);
  const mid = (i: number) => r2(L + (i / n) * plotW + bw / 2);
  const y = (v: number) => r2(T + plotH - (v / peak) * plotH);

  /** Hold the value across the day's width, then jump. */
  const held = (costs: number[]) =>
    costs.map((c, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(c)}L${r2(x(i) + bw)},${y(c)}`).join("");
  const area = (costs: number[]) => `${held(costs)}L${r2(L + plotW)},${y(0)}L${L},${y(0)}Z`;

  const leader = series.find((s) => s.lit) ?? series[0];
  const peakIdx = leader ? leader.costs.indexOf(Math.max(...leader.costs)) : -1;

  function move(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.floor(((px - L) / plotW) * n);
    setAt(i >= 0 && i < n ? i : null);
  }

  return (
    <div className="scopewrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="scopesvg"
        onMouseMove={move}
        onMouseLeave={() => setAt(null)}
        role="img"
        aria-label="Daily spend over the last thirty days"
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.user} id={`sfill-${s.user}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={s.lit ? 0.3 : 0.13} />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* y grid, labelled in money rather than in nothing */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line className="grid-l" x1={L} y1={y(peak * g)} x2={W - RGT} y2={y(peak * g)} />
            <text className="axlbl" x={L - 10} y={y(peak * g) + 3.5} textAnchor="end">
              {usd0(peak * g)}
            </text>
          </g>
        ))}

        {/* every seventh day gets a rule and a date */}
        {dates.map((d, i) =>
          i % 7 === 0 ? (
            <g key={d}>
              <line className="grid-v" x1={x(i)} y1={T} x2={x(i)} y2={T + plotH} />
              <text className="axlbl" x={x(i)} y={H - B + 21} textAnchor="middle">
                {d.slice(5)}
              </text>
            </g>
          ) : null,
        )}

        {series.map((s) => (
          <g key={s.user} className={s.lit ? "ser lit" : "ser"}>
            <path className="ar" d={area(s.costs)} fill={`url(#sfill-${s.user})`} />
            <path className="ln" d={held(s.costs)} />
          </g>
        ))}

        {/* the biggest day, named, because it is what anyone looks for first */}
        {leader && peakIdx >= 0 && (
          <g className="peak">
            <line x1={mid(peakIdx)} y1={y(leader.costs[peakIdx])} x2={mid(peakIdx)} y2={T - 6} />
            <text x={mid(peakIdx)} y={T - 11} textAnchor="middle">
              peak {usd0(leader.costs[peakIdx])} · {dates[peakIdx].slice(5)}
            </text>
          </g>
        )}

        <line className="now" x1={r2(L + plotW)} y1={T} x2={r2(L + plotW)} y2={T + plotH} />

        {at !== null && (
          <g className="cross">
            <line x1={mid(at)} y1={T} x2={mid(at)} y2={T + plotH} />
            {series.map((s) => (
              <circle
                key={s.user}
                className={s.lit ? "d lit" : "d"}
                cx={mid(at)}
                cy={y(s.costs[at])}
                r={3.5}
              />
            ))}
          </g>
        )}
      </svg>

      <div className="scoperead" aria-live="polite">
        <span className="day">{at === null ? "hover for a day" : dates[at]}</span>
        {series.map((s) => (
          <span key={s.user} className={s.lit ? "key" : "key g"}>
            <i />
            {s.user}
            {at !== null && <b>{s.costs[at] === 0 ? "idle" : usd(s.costs[at])}</b>}
          </span>
        ))}
      </div>
    </div>
  );
}
