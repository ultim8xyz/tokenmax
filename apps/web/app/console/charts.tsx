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
  /** Categorical colour slot, from slotOf(). -1 draws in the neutral ramp. */
  slot?: number;
}

/**
 * A monotone cubic through the daily samples (Fritsch-Carlson).
 *
 * The reason it is this and not a Catmull-Rom or a plain cardinal spline: a
 * spend chart must never bulge above a reading. Catmull-Rom overshoots between
 * points, which on this board would draw money nobody spent and would do it in
 * a comparison between two named people. Fritsch-Carlson clamps every tangent
 * so the curve is monotone across each interval, so a local maximum can only
 * ever be a day that actually happened.
 *
 * Two-decimal rounding throughout, or the server and the client disagree on the
 * last float digit and React calls that a hydration mismatch.
 */
function monotone(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  }

  // Tangents: the average of the neighbouring secants, then clamped.
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  m.push(slope[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    // Outside the circle of radius 3 the cubic can leave the data's range.
    if (h > 3) {
      m[i] = ((3 * a) / h) * slope[i];
      m[i + 1] = ((3 * b) / h) * slope[i];
    }
  }

  let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const t = dx[i] / 3;
    d +=
      `C${r2(pts[i][0] + t)},${r2(pts[i][1] + m[i] * t)}` +
      ` ${r2(pts[i + 1][0] - t)},${r2(pts[i + 1][1] - m[i + 1] * t)}` +
      ` ${r2(pts[i + 1][0])},${r2(pts[i + 1][1])}`;
  }
  return d;
}

/**
 * Daily spend, one curve per member.
 *
 * This was a held step chart, on the argument that a day is a bucket and
 * smoothing between samples invents readings. That argument still stands
 * against an unconstrained spline; the monotone fit above is the answer to it,
 * and the register strip under each member row still shows the raw daily
 * buckets undistorted. Flagged in the handoff either way.
 */
export function Scope({
  series,
  dates,
  stepped = false,
}: {
  series: Series[];
  dates: string[];
  /** Draw each day as its own held bucket instead of a fitted curve, with the
   *  monotone fit kept on top as a thin trend line. A single member's page is
   *  reading their own raw days, so the buckets should be literal there; the
   *  board is comparing people, where the curve is easier to follow. */
  stepped?: boolean;
}) {
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

  /** A day is plotted at the middle of its own width, not at its left edge. */
  const curve = (costs: number[]) => monotone(costs.map((c, i) => [mid(i), y(c)]));

  /** Sample and hold: each day is flat across its own width, and the value
   *  only moves on the boundary between two days. */
  const held = (costs: number[]) => {
    if (costs.length === 0) return "";
    let d = `M${x(0)},${y(costs[0])}`;
    costs.forEach((c, i) => {
      d += `L${x(i)},${y(c)}L${r2(x(i) + bw)},${y(c)}`;
    });
    return d;
  };

  const line = (costs: number[]) => (stepped ? held(costs) : curve(costs));
  const area = (costs: number[]) =>
    stepped
      ? `${held(costs)}L${r2(x(costs.length - 1) + bw)},${y(0)}L${x(0)},${y(0)}Z`
      : `${curve(costs)}L${mid(costs.length - 1)},${y(0)}L${mid(0)},${y(0)}Z`;

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
          {/* The bloom. One blur, sized in viewBox units and never animated:
              animating a blur radius repaints the whole stacking context every
              frame. `filterUnits` is userSpaceOnUse so a flat series does not
              get a filter region of zero height and vanish. */}
          <filter
            id="scope-bloom"
            filterUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={W}
            height={H}
          >
            <feGaussianBlur stdDeviation="3.6" />
          </filter>
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

        {/* Neon is two strokes of one path: a wide blurred copy for the bloom,
            a thin crisp one on top for the core. Soft bloom, thin core, or it
            reads as a smear rather than as a lit filament. The dash pattern is
            the secondary encoding, so the series stay separable without colour. */}
        {series.map((s) => {
          const d = line(s.costs);
          return (
            <g
              key={s.user}
              className={s.lit ? "ser lit" : "ser"}
              data-slot={s.slot ?? -1}
            >
              {/* The gradient lives inside the group on purpose: `currentColor`
                  in a stop resolves against the gradient element's own
                  inherited colour, not the colour of whatever references it.
                  In <defs> at the root every fill came out the same hue. */}
              <linearGradient id={`sfill-${s.user}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
              {/* Only the leading series is filled. Four translucent areas
                  stacked on each other is the spaghetti this has to survive. */}
              {s.lit && <path className="ar" d={area(s.costs)} fill={`url(#sfill-${s.user})`} />}
              <path className="glow" d={d} filter="url(#scope-bloom)" />
              <path className="ln" d={d} />
              {/* Stepped mode keeps the literal buckets and lays the fitted
                  curve over them, so the shape of the month is still readable
                  without the buckets being smoothed away. */}
              {stepped && s.lit && (
                <path className="trend" d={curve(s.costs)} filter="url(#scope-bloom)" />
              )}
              {stepped && s.lit && <path className="trend" d={curve(s.costs)} />}
            </g>
          );
        })}

        {/* the biggest day, named, because it is what anyone looks for first */}
        {leader && peakIdx >= 0 && (
          <g className="peak">
            <line x1={mid(peakIdx)} y1={y(leader.costs[peakIdx])} x2={mid(peakIdx)} y2={T - 6} />
            <text x={mid(peakIdx)} y={T - 11} textAnchor="middle">
              peak {usd0(leader.costs[peakIdx])} · {dates[peakIdx].slice(5)}
            </text>
          </g>
        )}

        <line className="now" x1={mid(n - 1)} y1={T} x2={mid(n - 1)} y2={T + plotH} />

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
          <span key={s.user} className={s.lit ? "key" : "key g"} data-slot={s.slot ?? -1}>
            <i />
            {s.user}
            {at !== null && <b>{s.costs[at] === 0 ? "idle" : usd(s.costs[at])}</b>}
          </span>
        ))}
      </div>
    </div>
  );
}
