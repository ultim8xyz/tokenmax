"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WINDOWS,
  costPerKiloLine,
  denseDays,
  slotOf,
  toks,
  total,
  usd,
  windowDays,
  type MemberRow,
  type WindowKey,
} from "@/lib/console/board";
import { Scope } from "./console/charts";
import { Chip, Chips, Ring, SegBar, Sticker, Tile } from "./console/bevel";

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
  // 7d is the default the server assumes, so it stays out of the URL. Anything
  // else has to travel with the link, or a profile's back button lands on 7d.
  const q = window === "7d" ? "" : `?w=${window}`;
  const pool = rows.reduce((a, r) => a + r.t.cost, 0);
  const lines = rows.reduce((a, r) => a + r.t.linesAdded, 0);
  const tokens = rows.reduce((a, r) => a + r.t.tokens, 0);

  // The register and the scope keep their own timebase: thirty days, whatever
  // the window is. A strip chart with its own clock is what an instrument does.
  const register = rows.map(({ m }) => ({
    user: m.username,
    days: denseDays(m.days, 30),
    slot: slotOf(members, m.username),
  }));
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
  const live = rows.length > 0;

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

        <div className="bboard">
          <div className="bmain">
          {rows.map(({ m, t }, i) => {
            const rate = costPerKiloLine(t.cost, t.linesAdded);
            const share = Math.round((t.cost / Math.max(1, pool)) * 100);
            return (
              <Link
                key={m.username}
                href={`/u/${m.username}${q}`}
                prefetch
                className={i === 0 ? "bt w2 bmem lead" : "bt w2 bmem"}
                aria-label={`${m.username}, rank ${i + 1}, ${usd(t.cost)}`}
              >
                <div className="bmemhead">
                  <span className="brk">
                    {i === 0 && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className="gold" src="/coin-gold.png" alt="" aria-hidden="true" />
                    )}
                    {i + 1}
                  </span>
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

          {rows.length === 0 && <EmptyBoard label={label} />}
          </div>

          <aside className="bside">
            {/* One card, four rows, rather than four cards with air between
                them. The rows are readings off the same instrument, and the
                totals only mean anything next to each other. */}
            <div className="bstack">
              <StatRow
                icon="dollar"
                title={`Pool · ${label}`}
                value={live ? usd(pool) : NONE}
                note={
                  live
                    ? `across ${rows.length} member${rows.length === 1 ? "" : "s"}`
                    : "nothing has reported in this window"
                }
              />
              <StatRow
                icon="check"
                title="Lines written"
                value={live && lines > 0 ? lines.toLocaleString("en-US") : NONE}
                note={live && lines > 0 ? "agent-assisted" : "counted off commits the agent signed"}
              />
              <StatRow
                icon="fire"
                title="Tokens burned"
                value={live && tokens > 0 ? toks(tokens) : NONE}
                note={live && tokens > 0 ? label : "totalled per machine, per day"}
              />
              <StatRow
                icon="spark"
                title="Cost per 1,000 lines"
                value={avgRate === null ? NONE : usd(avgRate)}
                note={
                  bestRate
                    ? `${bestRate.user} is cheapest at ${usd(bestRate.rate)}`
                    : "needs spend and lines together"
                }
                lead
              />
            </div>
          </aside>
        </div>

        <div className="bpair bfull">
            {leader && (
              <Tile icon="glass" title="At a glance">
                <div className="brings col">
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
                    slot: r.slot,
                  }))}
                  dates={dates}
                />
              </div>
            )}
        </div>

        <footer className="bwm">
          <span className="bwmk">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/coin.png" srcSet="/coin.png 1x, /coin@2x.png 2x" alt="" aria-hidden="true" />
            <b>tokenmax</b>
          </span>
          <span>spend is api list-price equivalent, not billed</span>
          <a className="bwmd" href="https://mishaovcharenko.com" target="_blank" rel="noreferrer">designed by misha</a>
        </footer>
      </div>
    </section>
  );
}

/** What a stat prints when there is no reading to print. Not a zero: zero is a
 *  measurement, and nothing has been measured. */
const NONE = "\u2014";

/** A row of the totals card. Same anatomy as the tile it replaces: sticker,
 *  title, figure, supporting line. `lead` marks the one reading the board is
 *  actually an argument about. */
function StatRow({
  icon, title, value, note, lead,
}: {
  icon: "cursor" | "spark" | "check" | "dollar" | "fire" | "glass";
  title: string;
  value: string;
  note: string;
  lead?: boolean;
}) {
  return (
    <div className={lead ? "bsrow lead" : "bsrow"}>
      <div className="bth">
        <Sticker kind={icon} />
        {title}
      </div>
      <div className={value === NONE ? "bfig none" : "bfig"}>{value}</div>
      <div className="bsub">{note}</div>
    </div>
  );
}

/**
 * The board with nothing on it.
 *
 * It was a grey rectangle reading "nothing logged in this window", which looks
 * like a page that failed rather than a board waiting for its first machine.
 * Now it says what will be in the list, keeps the shape of the list so the
 * space is legibly a list, and gives the one command that fills it.
 *
 * The seats are deliberately not skeletons: they carry a rank and the word
 * open, and nothing on them moves, because nothing is loading.
 */
function EmptyBoard({ label }: { label: string }) {
  return (
    <div className="bt w4 bempty">
      <div className="bth">
        <Sticker kind="glass" />
        {label === "today" ? "Nothing reported today" : `Nothing reported in the last ${label}`}
      </div>
      <p className="bemptyp">
        The ranking goes here: who spent what, the days they worked, and what a
        thousand lines cost each of them. A machine joins the board by running one
        command on it.
      </p>

      <div className="bseats">
        {[1, 2, 3, 4].map((n) => (
          <div className="bseat" key={n}>
            <span className="brk">{n}</span>
            <span className="bav sm" />
            <span className="bseatn">open</span>
            <span className="bseg">
              {Array.from({ length: 30 }, (_, k) => (
                <i key={k} />
              ))}
            </span>
          </div>
        ))}
      </div>

      <code className="bcmd">npx github:ultim8xyz/tokenmax-cli setup &lt;token&gt;</code>
      <span className="bcmdn">Your token is on the onboarding screen.</span>
    </div>
  );
}
