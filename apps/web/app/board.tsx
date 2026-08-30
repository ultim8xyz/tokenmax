"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WINDOWS,
  costPerKiloLine,
  denseDays,
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
 *
 * The plate is one instrument face: modules butt together on shared rules,
 * every module carries the same anatomy, and exactly one object on it is lit.
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

function Dial({ needles }: { needles: { user: string; rate: number; lit: boolean }[] }) {
  const CX = 150, CY = 126, R = 100;
  const angle = (v: number) => Math.PI - Math.PI * Math.min(1, Math.max(0, v) / GAUGE_MAX);
  // Rounded, because the server and the client disagree on the last float
  // digit and React calls that a hydration mismatch.
  const at = (v: number, r = R) => {
    const a = angle(v);
    return [
      Number((CX + Math.cos(a) * r).toFixed(2)),
      Number((CY - Math.sin(a) * r).toFixed(2)),
    ] as const;
  };
  const ticks = [];
  for (let v = 0; v <= GAUGE_MAX; v += 10) {
    const maj = v % 30 === 0;
    const [x1, y1] = at(v, R - (maj ? 11 : 6));
    const [x2, y2] = at(v);
    ticks.push(<line key={`t${v}`} className={maj ? "tick maj" : "tick"} x1={x1} y1={y1} x2={x2} y2={y2} />);
    if (maj) {
      const [lx, ly] = at(v, R - 22);
      ticks.push(
        <text key={`l${v}`} className="lbl" textAnchor="middle" x={lx} y={ly + 3}>
          {v}
        </text>,
      );
    }
  }
  const [ax, ay] = at(0);
  const [bx, by] = at(GAUGE_MAX);
  return (
    <svg viewBox="0 8 300 150" aria-hidden="true">
      <path className="arc" d={`M${ax},${ay} A${R},${R} 0 0 1 ${bx},${by}`} />
      {ticks}
      {needles.map((n) => {
        const [x, y] = at(n.rate);
        return <line key={n.user} className={n.lit ? "needle" : "ghost"} x1={CX} y1={CY} x2={x} y2={y} />;
      })}
      <circle className="hub" cx={CX} cy={CY} r={2.5} />
    </svg>
  );
}

/** Both members' thirty days, sampled and held. A strip chart, not a curve. */
function Scope({ series }: { series: { user: string; costs: number[]; lit: boolean }[] }) {
  const peak = Math.max(1, ...series.flatMap((s) => s.costs));
  const span = Math.max(1, (series[0]?.costs.length ?? 1) - 1);
  return (
    <svg viewBox="0 0 300 96" preserveAspectRatio="none" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <line key={i} className="grid-l" x1="0" y1={i * 24} x2="300" y2={i * 24} />
      ))}
      {series.map((s) => (
        <path
          key={s.user}
          className={s.lit ? "wave" : "wave b"}
          d={s.costs
            .map((c, i) => {
              const x = ((i / span) * 300).toFixed(1);
              const y = (92 - (c / peak) * 84).toFixed(1);
              return i === 0 ? `M0,${y}` : `H${x}V${y}`;
            })
            .join("")}
        />
      ))}
      <line className="now" x1="300" y1="0" x2="300" y2="96" />
    </svg>
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

  // The register keeps its own timebase: thirty days, whatever the window is.
  const register = rows.map(({ m }) => ({ user: m.username, days: denseDays(m.days, 30) }));
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
                const lit = i === 0;
                // The card's number is the member's own spend, not a fiction.
                const last4 = String(Math.floor(t.cost)).slice(-4).padStart(4, "0");
                return (
                  <Link
                    key={m.username}
                    href={`/u/${m.username}`}
                    prefetch
                    className="strip"
                    data-lead={lit ? "" : undefined}
                    style={{ "--th": m.hue } as React.CSSProperties}
                    aria-label={`${m.username}, rank ${i + 1}, ${usd(t.cost)}`}
                    onPointerEnter={() => setHue(m.hue)}
                    onFocus={() => setHue(m.hue)}
                  >
                    <div className="who">
                      <span className="rk">{String(i + 1).padStart(2, "0")}</span>
                      <span className="tmcard">
                        {m.avatarUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img className="face" src={m.avatarUrl} alt="" />
                        )}
                        <span className="wash" />
                        <span className="wm">TOKENMAX</span>
                        <svg className="star" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 0c.6 6.3 5.1 10.8 12 12-6.9 1.2-11.4 5.7-12 12-.6-6.3-5.1-10.8-12-12C6.9 10.8 11.4 6.3 12 0z" />
                        </svg>
                        <span className="chip" />
                        <span className="pan">
                          <i />
                          <i />
                          <i />
                          <i />
                          {last4}
                        </span>
                      </span>
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

              {rows.length === 0 && (
                <div className="noneyet">nothing logged in this window</div>
              )}
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

            <div className="pfoot">
              <span>spend is api list-price equivalent, not billed</span>
              <span>
                n={rows.length}
                {slots > 0 ? ` · ${slots} slot${slots === 1 ? "" : "s"} open` : ""}
              </span>
            </div>
          </div>

          <div className="pcol pside">
            <div className="gauge">
              <div className="k">
                cost per 1,000 lines<span className="u">usd · lower is better</span>
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

            <div className="scope">
              <div className="k">
                daily spend<span className="u">30d · all members</span>
              </div>
              <Scope
                series={register.map((r, i) => ({
                  user: r.user,
                  costs: r.days.map((d) => d.cost),
                  lit: i === 0,
                }))}
              />
              <div className="ax">
                <span>{register[0]?.days[0]?.date}</span>
                <span>today</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
