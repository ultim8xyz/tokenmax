"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WINDOWS,
  costPerKiloLine,
  denseDays,
  sci,
  total,
  usd,
  windowDays,
  type MemberRow,
  type WindowKey,
} from "@/lib/console/board";
import { setHue } from "./console/hue";
import { GaugePanel, Register, Scope } from "./console/charts";

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
                      <Register days={reg} />
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
            <GaugePanel hue={members[0]?.hue ?? 262} rates={rates} />
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
