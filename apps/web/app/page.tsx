import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { loadBoard } from "@/lib/console/load";
import { maxDowntimeSeconds, type ActivityDay } from "@/lib/downtime";
import {
  WINDOWS,
  classOf,
  dur,
  parseWindow,
  sparkline,
  streakOf,
  toks,
  total,
  usd,
  usd0,
  windowDays,
  type WindowKey,
} from "@/lib/console/board";
import { Shell } from "./console/shell";
import { HueDrift } from "./console/hue";
import { HueRow } from "./console/hue-row";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  await requireMember("/");
  const { w } = await searchParams;
  const window: WindowKey = parseWindow(w);

  const members = await loadBoard();
  const rows = members
    .map((m) => ({ m, t: total(windowDays(m.days, window)) }))
    .filter((r) => r.t.cost > 0)
    .sort((a, b) => b.t.cost - a.t.cost);

  const pot = usd0(members.reduce((a, m) => a + total(m.days).cost, 0));
  const label = WINDOWS.find((x) => x.key === window)!.label.toLowerCase();

  return (
    <Shell active="/" pot={pot} members={members.length}>
      <HueDrift hue={rows[0]?.m.hue ?? 210} />
      <section className="view on" id="lineup">
        <div className="shelfhead rise" style={{ "--i": 0 } as React.CSSProperties}>
          <h1>Leaderboard</h1>
          <span className="sub">Ranked by spend · {label}</span>
          <div className="seg">
            {WINDOWS.map((x) => (
              <Link
                key={x.key}
                href={`/?w=${x.key}`}
                aria-pressed={String(window === x.key) as "true" | "false"}
              >
                {x.label}
              </Link>
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
            <span className="r">Spend</span>
          </div>

          <div className="brows">
            {rows.map(({ m, t }, i) => {
              const [name, note] = classOf(m.days);
              const spark = sparkline(m.days);
              return (
                <HueRow
                  key={m.username}
                  href={`/u/${m.username}`}
                  hue={m.hue}
                  className={`brow${i === 0 ? " top" : ""}`}
                  ariaLabel={`${m.username}, rank ${i + 1}, ${usd(t.cost)}`}
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
                  <div className="fig spend">{usd(t.cost)}</div>
                </HueRow>
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
    </Shell>
  );
}
