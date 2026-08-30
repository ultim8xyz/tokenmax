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
import { Scope } from "./console/charts";
import { Chip, Chips, Fig, Ring, SegBar, Sticker, Sub, Tile } from "./console/bevel";

/**
 * The board, switched in the browser.
 *
 * All three windows are cut from the same thirty days, so the server has
 * nothing extra to give: making the switch a navigation meant two auth round
 * trips to re-render numbers already in the page.
 *
 * Same Bevel language as a member page — one dark tile per thing, a sticker
 * glyph on every title, no rules and no borders. A member is a tile you can
 * click into rather than a row in a table.
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
  const bestRate = rates[0] ?? null;
  const avgRate =
    rates.length > 0 ? rates.reduce((a, r) => a + r.rate, 0) / rates.length : null;

  const slots = Math.max(0, 6 - rows.length);
  const leader = rows[0] ?? null;

  return (
    <section className="view on" id="lineup">
      <div className="bevel">
        <div className="bhead">
          <div>
            <h1>Leaderboard</h1>
            <div className="bm">
              {rows.length} member{rows.length === 1 ? "" : "s"} · {label} · ranked by spend
            </div>
          </div>
          <span className="bseg-ctl">
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
        </div>

        <div className="bgrid">
          <Tile icon="cursor" title={`Pool · ${label}`}>
            <Fig v={usd(pool)} />
            <Sub>across {rows.length} member{rows.length === 1 ? "" : "s"}</Sub>
          </Tile>

          <Tile icon="check" title="Lines written">
            <Fig v={lines.toLocaleString("en-US")} />
            <Sub>agent-assisted</Sub>
          </Tile>

          <Tile icon="spark" title="Tokens burned">
            <Fig v={sci(tokens)} />
            <Sub>{label}</Sub>
          </Tile>

          <Tile icon="rocket" title="Cost per 1,000 lines">
            <Fig v={avgRate === null ? "—" : usd(avgRate)} />
            <Sub>
              {bestRate ? `${bestRate.user} is cheapest at ${usd(bestRate.rate)}` : "no lines yet"}
            </Sub>
          </Tile>

          {rows.map(({ m, t }, i) => {
            const rate = costPerKiloLine(t.cost, t.linesAdded);
            const share = Math.round((t.cost / Math.max(1, pool)) * 100);
            return (
              <Link
                key={m.username}
                href={`/u/${m.username}`}
                prefetch
                className="bt w2 bmem"
                aria-label={`${m.username}, rank ${i + 1}, ${usd(t.cost)}`}
              >
                <div className="bmemhead">
                  <span className="brk">{i + 1}</span>
                  {m.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="bav sm" src={m.avatarUrl} alt="" />
                  ) : (
                    <span className="bav sm" />
                  )}
                  <span className="bnm">
                    <b>{m.displayName ?? m.username}</b>
                    <i>
                      {t.devices} machine{t.devices === 1 ? "" : "s"} · {t.active} of 30 days
                    </i>
                  </span>
                  <span className="bspend">{usd(t.cost)}</span>
                </div>

                <SegBar costs={register[i].days.map((d) => d.cost)} />

                <Chips>
                  <Chip tone="n">{share}% of pool</Chip>
                  <Chip tone="n">{rate === null ? "no lines" : `${usd(rate)} per 1k lines`}</Chip>
                  <Chip tone="n">{t.linesAdded.toLocaleString("en-US")} lines</Chip>
                  <Chip tone="n">{t.commits} commits</Chip>
                </Chips>
              </Link>
            );
          })}

          {rows.length === 0 && (
            <div className="bt w4">
              <Sub>nothing logged in this window</Sub>
            </div>
          )}

          {leader && (
            <Tile icon="rocket" title="The board at a glance" span={2}>
              <div className="brings">
                <Ring
                  pct={Math.round((leader.t.cost / Math.max(1, pool)) * 100)}
                  colour="var(--bv-orange)"
                  value={`${Math.round((leader.t.cost / Math.max(1, pool)) * 100)}%`}
                  label={leader.m.username}
                  note="of the pool"
                />
                <Ring
                  pct={(rows.filter((r) => r.t.linesAdded > 0).length / Math.max(1, rows.length)) * 100}
                  colour="var(--bv-lime)"
                  value={`${rows.filter((r) => r.t.linesAdded > 0).length}/${rows.length}`}
                  label="Reporting lines"
                  note="members synced"
                />
                <Ring
                  pct={(rows.length / 6) * 100}
                  colour="var(--bv-peri)"
                  value={`${rows.length}`}
                  label="Members"
                  note={slots > 0 ? `${slots} slots open` : "board full"}
                />
              </div>
            </Tile>
          )}

          {dates.length > 0 && (
            <div className="bt w4 bscope scope">
              <div className="bth">
                <Sticker kind="cursor" />
                Daily spend
              </div>
              <Scope
                series={register.map((r, i) => ({
                  user: r.user,
                  costs: r.days.map((d) => d.cost),
                  lit: i === 0,
                }))}
                dates={dates}
              />
            </div>
          )}

          {Array.from({ length: slots }, (_, i) => (
            <div className="bt bslot" key={i}>
              <span className="brk">{rows.length + i + 1}</span>
              <em>open</em>
            </div>
          ))}
        </div>

        <div className="bfoot">
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
