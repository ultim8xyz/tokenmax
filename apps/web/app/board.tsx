"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WINDOWS,
  costPerKiloLine,
  denseDays,
  total,
  usd,
  usd0,
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
 *
 * The plate is one instrument face: modules butt together on shared rules and
 * every module carries the same anatomy. Exactly one surface on it is glass —
 * the gauge — because that is the reading the whole board argues about.
 */

/** Scientific notation, which is what a readout of this magnitude wants. */
function sci(n: number): string {
  if (n <= 0) return "0";
  const e = Math.floor(Math.log10(n));
  return `${(n / 10 ** e).toFixed(2)}e${e}`;
}

/** Density ramp for the register. An idle day prints, so gaps stay countable. */
const RAMP = [".", "░", "▒", "▓", "█"];

/** The gauge is scaled past the worst reading so the needle never pins. */
const GAUGE_MAX = 120;

/** Rounded, or the server and the client disagree on the last float digit and
 *  React calls that a hydration mismatch. */
const r2 = (n: number) => Number(n.toFixed(2));

interface Needle {
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

interface Series {
  user: string;
  costs: number[];
  lit: boolean;
}

/**
 * Thirty days of daily spend, sampled and held. A strip chart, not a curve:
 * a day is a flat step because a day is a bucket, and smoothing between the
 * samples invents readings that were never taken.
 */
function Scope({ series, dates }: { series: Series[]; dates: string[] }) {
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
  const pool = rows.reduce((a, r) => a + r.t.cost, 0);
  const lines = rows.reduce((a, r) => a + r.t.linesAdded, 0);
  const tokens = rows.reduce((a, r) => a + r.t.tokens, 0);

  // The register and the scope keep their own timebase: thirty days, whatever
  // the window is. A strip chart with its own clock is what an instrument does.
  const register = rows.map(({ m }) => ({ user: m.username, days: denseDays(m.days, 30) }));
  const dates = register[0]?.days.map((d) => d.date) ?? [];

  const rates = rows
    .map(({ m, t }) => ({ user: m.username, rate: costPerKiloLine(t.cost, t.linesAdded) }))
    .filter((r): r is { user: string; rate: number } => r.rate !== null)
    .sort((a, b) => a.rate - b.rate);
  const best = rates[0] ?? null;

  const slots = Math.max(0, 6 - rows.length);

  return (
    <section className="view on" id="lineup">
      <div className="plate">
        <span className="mark-tr" aria-hidden="true" />
        <span className="mark-bl" aria-hidden="true" />
        <span className="scan" aria-hidden="true" />

        <div className="pbar">
          <span className="pseg">
            {WINDOWS.map((x) => (
              <button
                key={x.key}
                onClick={() => choose(x.key)}
                aria-pressed={String(window === x.key) as "true" | "false"}
              >
                {x.label.toLowerCase()}
              </button>
            ))}
          </span>
          <span className="ptxt">sort spend/desc</span>
          <span className="end">
            <i className="led" aria-hidden="true" />
            {rows.length} member{rows.length === 1 ? "" : "s"} · {label}
          </span>
        </div>

        <h1 className="sr-only">Leaderboard, ranked by spend, {label}</h1>

        <div className="pgrid">
          <div className="pcol">
            <div className="mods">
              <div className="mod">
                <div className="k">
                  pool<span className="u">usd/{label.replace(/\s/g, "")}</span>
                </div>
                <div className="v">{usd(pool)}</div>
              </div>
              <div className="mod">
                <div className="k">
                  lines<span className="u">added</span>
                </div>
                <div className="v sm">{lines.toLocaleString("en-US")}</div>
              </div>
              <div className="mod">
                <div className="k">
                  tokens<span className="u">{label.replace(/\s/g, "")}</span>
                </div>
                <div className="v sm">{sci(tokens)}</div>
              </div>
              <div className="mod">
                <div className="k">
                  members<span className="u">n</span>
                </div>
                <div className="v sm">{rows.length}</div>
              </div>
            </div>

            <div className="strips">
              {rows.map(({ m, t }, i) => {
                const rate = costPerKiloLine(t.cost, t.linesAdded);
                const reg = register[i].days;
                const peak = Math.max(1, ...reg.map((d) => d.cost));
                return (
                  <Link
                    key={m.username}
                    href={`/u/${m.username}`}
                    prefetch
                    className="strip"
                    data-lead={i === 0 ? "" : undefined}
                    style={{ "--th": m.hue } as React.CSSProperties}
                    aria-label={`${m.username}, rank ${i + 1}, ${usd(t.cost)}`}
                    onPointerEnter={() => setHue(m.hue)}
                    onFocus={() => setHue(m.hue)}
                  >
                    <div className="who">
                      <span className="rk">{String(i + 1).padStart(2, "0")}</span>
                      {m.avatarUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img className="pfp" src={m.avatarUrl} alt="" />
                      )}
                      <span className="nm">
                        <b>{m.displayName ?? m.username}</b>
                        <span>
                          {t.devices} machine{t.devices === 1 ? "" : "s"} · {t.active}/30d active
                        </span>
                      </span>
                    </div>

                    <div className="readbank">
                      <div className="ascii">
                        <div className="k">
                          daily spend register<span className="u">30d · · ░ ▒ ▓ █</span>
                        </div>
                        <div className="glyphs">
                          {reg.map((d, k) => (
                            <i
                              key={d.date}
                              data-off={d.cost === 0 ? "" : undefined}
                              data-now={k === reg.length - 1 ? "" : undefined}
                              title={`${d.date} · ${d.cost === 0 ? "no activity" : usd(d.cost)}`}
                            >
                              {d.cost === 0 ? RAMP[0] : RAMP[Math.min(4, Math.floor((d.cost / peak) * 4.999))]}
                            </i>
                          ))}
                        </div>
                        <div className="scale">
                          <span>{reg[0]?.date}</span>
                          <span>{reg[reg.length - 1]?.date}</span>
                        </div>
                      </div>
                      <div className="figs">
                        <div>
                          <div className="k">tokens</div>
                          <div className="v q">{sci(t.tokens)}</div>
                        </div>
                        <div>
                          <div className="k">lines</div>
                          <div className="v q">{t.linesAdded.toLocaleString("en-US")}</div>
                        </div>
                        <div>
                          <div className="k">commits</div>
                          <div className="v q">{t.commits}</div>
                        </div>
                        <div>
                          <div className="k">$/1k lines</div>
                          <div className="v">{rate === null ? "—" : usd(rate)}</div>
                        </div>
                        <div>
                          <div className="k">spend</div>
                          <div className="v">{usd(t.cost)}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {rows.length === 0 && <div className="noneyet">nothing logged in this window</div>}
            </div>

            <div className="slots">
              {Array.from({ length: slots }, (_, i) => (
                <div className="slot" key={i}>
                  <span>{String(rows.length + i + 1).padStart(2, "0")}</span>
                  <em>open</em>
                </div>
              ))}
            </div>
            <div className="filler" aria-hidden="true" />
          </div>

          <div className="pcol pside">
            {/* The one glass surface on the plate. Everything else is matte. */}
            <div
              className="gauge"
              style={{ "--th": members[0]?.hue ?? 262 } as React.CSSProperties}
            >
              <span className="glass" aria-hidden="true" />
              <div className="gin">
                <div className="k">
                  cost per 1,000 lines<span className="u">usd</span>
                </div>
                <Dial needles={rates.map((r) => ({ ...r, lit: r.user === best?.user }))} />
                <div className="read">
                  <b>{best ? usd(best.rate) : "—"}</b>
                  <span>{best?.user ?? "no lines counted yet"}</span>
                </div>
                <div className="legend">
                  {rates.map((r) => (
                    <span key={r.user} className={r.user === best?.user ? "" : "g"}>
                      <i />
                      {r.user} {usd(r.rate)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The scope gets the full width of the plate. A chart squeezed into a
         *  side rail is a decoration, not an instrument. */}
        <div className="scope">
          <div className="k">
            daily spend<span className="u">30d · sample and hold · all members</span>
          </div>
          {dates.length > 0 && (
            <Scope
              series={register.map((r, i) => ({
                user: r.user,
                costs: r.days.map((d) => d.cost),
                lit: i === 0,
              }))}
              dates={dates}
            />
          )}
        </div>

        <div className="pfoot">
          <span>spend is api list-price equivalent, not billed</span>
          <span>
            n={rows.length}
            {slots > 0 ? ` · ${slots} slot${slots === 1 ? "" : "s"} open` : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
