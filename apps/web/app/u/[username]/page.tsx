import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadBoard, loadMember } from "@/lib/console/load";
import {
  classOf,
  costPerKiloLine,
  denseDays,
  dur,
  sci,
  streakOf,
  total,
  usd,
  windowDays,
} from "@/lib/console/board";
import { maxDowntimeSeconds, type ActivityDay } from "@/lib/downtime";
import { Shell } from "../../console/shell";
import { GaugePanel, Register, Scope } from "../../console/charts";
import { HueDrift } from "../../console/hue";

export const dynamic = "force-dynamic";

/** One module, with the plate's anatomy: key left, unit right, figure below. */
function Mod({ k, u, v, n, sm }: { k: string; u?: string; v: string; n?: string; sm?: boolean }) {
  return (
    <div className="mod">
      <div className="k">
        {k}
        {u && <span className="u">{u}</span>}
      </div>
      <div className={sm ? "v sm" : "v"}>{v}</div>
      {n && <div className="n">{n}</div>}
    </div>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await requireMember(`/u/${username}`);
  const member = await loadMember(username);
  if (!member) notFound();

  const isSelf = viewer.id === member.id;
  if (!member.isListed && !isSelf) notFound();

  const t = total(member.days);
  const [className, classNote] = classOf(member.days);
  const board = await loadBoard();
  const ranked = board
    .map((m) => ({ u: m.username, cost: total(m.days).cost }))
    .filter((r) => r.cost > 0)
    .sort((a, b) => b.cost - a.cost);
  const rank = ranked.findIndex((r) => r.u === member.username) + 1;

  const quiet = maxDowntimeSeconds(member.days as unknown as ActivityDay[]);
  const mixTotal = member.mix.reduce((a, [, n]) => a + n, 0);
  const rate = costPerKiloLine(t.cost, t.linesAdded);
  const pot = board.reduce((a, m) => a + total(m.days).cost, 0);
  const today = total(windowDays(member.days, "1d"));
  const days = denseDays(member.days, 30);

  return (
    <Shell active={`/u/${viewer.username}`} pot={pot} members={board.length} me={viewer}>
      <HueDrift hue={member.hue} />
      <section className="view on" id="lineup">
        <div className="plate">
          <span className="mark-tr" aria-hidden="true" />
          <span className="mark-bl" aria-hidden="true" />
          <span className="scan" aria-hidden="true" />

          <div className="pbar">
            <Link href="/" className="pback" aria-label="Back to the leaderboard">
              ← board
            </Link>
            <span className="ptxt">
              {rank > 0 ? `rank ${String(rank).padStart(2, "0")}/${ranked.length}` : "unranked"}
            </span>
            <span className="ptxt">win 30d</span>
            <span className="end">
              <i className="led" aria-hidden="true" />
              {member.username}
            </span>
          </div>

          <h1 className="sr-only">{member.displayName ?? member.username}, rank {rank}</h1>

          <div className="pgrid">
            <div className="pcol">
              <div className="idstrip">
                <span className="rk">{rank > 0 ? String(rank).padStart(2, "0") : "--"}</span>
                {member.avatarUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className="pfp" src={member.avatarUrl} alt="" />
                )}
                <span className="nm">
                  <b>{member.displayName ?? member.username}</b>
                  <span>
                    {className} · {classNote}
                  </span>
                </span>
              </div>

              <div className="mods">
                <Mod k="spend" u="usd/30d" v={usd(t.cost)} />
                <Mod k="tokens" u="30d" v={sci(t.tokens)} sm />
                <Mod k="sessions" u="n" v={String(t.sessions)} n={`${t.interactive} you opened`} sm />
                <Mod
                  k="streak"
                  u="days"
                  v={`${streakOf(member.days)}d`}
                  n={`${t.active} of 30 active`}
                  sm
                />
              </div>

              <Register days={days} />

              <div className="mods">
                <Mod k="in field" u="peak" v={String(t.peak)} n="concurrent agents" sm />
                <Mod
                  k="lines"
                  u="added"
                  v={t.linesAdded > 0 ? t.linesAdded.toLocaleString("en-US") : "—"}
                  n={t.linesAdded > 0 ? "agent-assisted" : isSelf ? "run tokenmax to fill this in" : "not synced"}
                  sm
                />
                <Mod k="commits" u="claude trailer" v={String(t.commits)} sm />
                <Mod k="projects" u="busiest day" v={String(t.projects)} sm />
              </div>

              <div className="mods">
                <Mod k="today" u="usd" v={usd(today.cost)} n={`${sci(today.tokens)} tokens`} sm />
                <Mod k="longest quiet" u="between turns" v={dur(quiet)} sm />
                <Mod
                  k="machines"
                  u="n"
                  v={String(member.devices.length)}
                  n={member.devices.length === 1 ? "reporting" : "reporting"}
                  sm
                />
                <Mod k="pool share" u="of board" v={`${Math.round((t.cost / Math.max(1, pot)) * 100)}%`} sm />
              </div>

              {/* A machine name is the owner's business and nobody else's. */}
              {isSelf && (
                <div className="modwide">
                  <div className="k">
                    your machines<span className="u">last seen</span>
                  </div>
                  <div className="rigs">
                    {member.devices.length === 0 && <div className="rig">nothing reporting yet</div>}
                    {member.devices.map((d) => (
                      <div className="rig" key={d.name + d.lastSeenAt}>
                        <span className="n">{d.name}</span>
                        <span className="a">{d.lastSeenAt.slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modwide">
                <div className="k">
                  model mix<span className="u">share of tokens</span>
                </div>
                <div className="mixes">
                  {member.mix.length === 0 && <div className="rig">no models yet</div>}
                  {member.mix.slice(0, 3).map(([model, tokens]) => {
                    const pc = Math.round((tokens / Math.max(1, mixTotal)) * 100);
                    return (
                      <div className="mixline" key={model}>
                        <span className="m">{model}</span>
                        <span className="track">
                          <span style={{ width: `${pc}%` }} />
                        </span>
                        <span className="p">{pc}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="filler" aria-hidden="true" />
            </div>

            <div className="pcol pside">
              <GaugePanel
                hue={member.hue}
                rates={rate === null ? [] : [{ user: member.username, rate }]}
                note={rate === null ? undefined : "what this member's output costs"}
              />
            </div>
          </div>

          <div className="scope">
            <div className="k">
              daily spend<span className="u">30d · sample and hold</span>
            </div>
            <Scope
              series={[{ user: member.username, costs: days.map((d) => d.cost), lit: true }]}
              dates={days.map((d) => d.date)}
            />
          </div>

          <div className="pfoot">
            <span>spend is api list-price equivalent, not billed</span>
            <span>{member.username} · 30 day window</span>
          </div>
        </div>
      </section>
    </Shell>
  );
}
