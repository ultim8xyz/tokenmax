import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadBoard, loadMember } from "@/lib/console/load";
import {
  classOf,
  costPerKiloLine,
  dur,
  streakOf,
  toks,
  total,
  usd,
  usd0,
  windowDays,
} from "@/lib/console/board";
import { maxDowntimeSeconds, type ActivityDay } from "@/lib/downtime";
import { Shell } from "../../console/shell";
import { SpendChart, World } from "./art";
import { HueDrift } from "../../console/hue";

export const dynamic = "force-dynamic";

function Big({
  k,
  v,
  n,
  hi,
}: {
  k: string;
  v: string;
  n?: string;
  hi?: boolean;
}) {
  return (
    <div className={`big${hi ? " hi" : ""}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
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
  const rank =
    board
      .map((m) => ({ u: m.username, cost: total(m.days).cost }))
      .filter((r) => r.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .findIndex((r) => r.u === member.username) + 1;

  const peakDay = Math.max(0, ...member.days.map((d) => Number(d.cost_usd)));
  const quiet = maxDowntimeSeconds(member.days as unknown as ActivityDay[]);
  const mixTotal = member.mix.reduce((a, [, n]) => a + n, 0);
  const rate = costPerKiloLine(t.cost, t.linesAdded);
  const pot = usd0(board.reduce((a, m) => a + total(m.days).cost, 0));

  return (
    <Shell active={`/u/${viewer.username}`} pot={pot} members={board.length} me={viewer}>
      <HueDrift hue={member.hue} />
      <section className="view on" id="card">
        <div className="cardwrap">
          <Link href="/" className="back" aria-label="Back to the leaderboard">
            ←
          </Link>

          <div className="side">
            <div className="art rise" style={{ "--i": 0 } as React.CSSProperties}>
              {member.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="pfp" src={member.avatarUrl} alt="" />
              ) : (
                <World hue={member.hue} seed={member.hue} kind={className.toLowerCase()} />
              )}
              <div className="over">
                <div className="nm">{member.displayName ?? member.username}</div>
                <div className="sub">
                  {rank > 0 ? `Rank ${String(rank).padStart(2, "0")} · ` : ""}
                  {className} · {classNote}
                </div>
              </div>
            </div>

            <div className="big rise" style={{ "--i": 2 } as React.CSSProperties}>
              <div className="k">{isSelf ? "Your machines" : "Machines"}</div>
              {/* A machine name is the owner's business and nobody else's, and a
                  column of the word "hidden" told everyone how many there were
                  while saying nothing useful. Visitors get the count. */}
              {isSelf ? (
                <div className="rigs">
                  {member.devices.length === 0 && <div className="rig">nothing reporting yet</div>}
                  {member.devices.map((d, i) => (
                    <div className="rig" key={d.name + d.lastSeenAt}>
                      <span
                        className="d"
                        style={{
                          background:
                            i === 0 ? `hsl(${member.hue}, 96%, 66%)` : "rgba(150,166,205,0.34)",
                          boxShadow: i === 0 ? `0 0 10px hsl(${member.hue}, 96%, 60%)` : undefined,
                        }}
                      />
                      <span className="n">{d.name}</span>
                      <span className="a">{d.lastSeenAt.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="v">{member.devices.length}</div>
                  <div className="n">
                    {member.devices.length === 1 ? "machine reporting" : "machines reporting"}
                  </div>
                </>
              )}
            </div>

            <div className="duo rise" style={{ "--i": 3 } as React.CSSProperties}>
              <div className="big">
                <div className="k">Machines</div>
                <div className="v">{member.devices.length}</div>
                <div className="n">reporting</div>
              </div>
              <div className="big">
                <div className="k">Longest quiet</div>
                <div className="v">{dur(quiet)}</div>
                <div className="n">between turns</div>
              </div>
            </div>
          </div>

          <div className="panes">
            <div className="bigrow rise" style={{ "--i": 1 } as React.CSSProperties}>
              <Big k="Spend · 30d" v={usd(t.cost)} n={`${toks(t.tokens)} tokens`} hi />
              <Big k="In field" v={String(t.peak)} n="peak concurrent agents" />
              <Big k="Sessions" v={String(t.sessions)} n={`${t.interactive} you opened`} />
              <Big
                k="Streak"
                v={`${streakOf(member.days)}d`}
                n={`${t.active} of 30 days active`}
              />
            </div>

            <div className="chart rise" style={{ "--i": 2 } as React.CSSProperties}>
              <SpendChart days={member.days} hue={member.hue} />
              <div className="lbl">Daily spend · last 30</div>
              <div className="peak">peak {usd(peakDay)}</div>
            </div>

            <div className="bigrow rise" style={{ "--i": 2 } as React.CSSProperties}>
              <Big
                k="Per 1,000 lines"
                v={rate === null ? "—" : usd(rate)}
                n={rate === null ? "no lines counted yet" : "what output costs"}
                hi
              />
              <Big
                k="Lines written"
                v={t.linesAdded > 0 ? toks(t.linesAdded) : "—"}
                n={
                  t.linesAdded > 0
                    ? "added, agent-assisted"
                    : isSelf
                      ? "run tokenmax to fill this in"
                      : "not synced since lines landed"
                }
              />
              <Big k="Commits" v={String(t.commits)} n="carrying a Claude trailer" />
              <Big k="Projects" v={String(t.projects)} n="busiest day" />
            </div>

            <div className="strip rise" style={{ "--i": 3 } as React.CSSProperties}>
              <div className="big">
                <div className="k">Model mix</div>
                <div className="mix" style={{ marginTop: 10 }}>
                  {member.mix.length === 0 && <div className="mixrow">no models yet</div>}
                  {member.mix.slice(0, 3).map(([model, tokens], i) => (
                    <div className={`mixrow ${["a", "b", "c"][i]}`} key={model}>
                      <span className="m">{model}</span>
                      <span className="tr">
                        <i style={{ width: `${(tokens / Math.max(1, mixTotal)) * 100}%` }} />
                      </span>
                      <span className="fr">
                        {Math.round((tokens / Math.max(1, mixTotal)) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="big">
                <div className="k">Today</div>
                <div className="v">{usd(total(windowDays(member.days, "1d")).cost)}</div>
                <div className="n">{toks(total(windowDays(member.days, "1d")).tokens)} tokens</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
