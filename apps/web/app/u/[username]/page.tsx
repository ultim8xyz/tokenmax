import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadBoard, loadMember } from "@/lib/console/load";
import {
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
import { Scope } from "../../console/charts";
import { Chip, Chips, Fig, Ring, ScaleBar, SegBar, Sticker, Sub, Tile } from "../../console/bevel";
import { HueDrift } from "../../console/hue";

export const dynamic = "force-dynamic";

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
  const share = Math.round((t.cost / Math.max(1, pot)) * 100);

  /* Every comparison on this page is computed from data already loaded. The app
   * fetches a 30 day window only (loadMember: since = today - 29), so there is
   * no previous period to diff against and none is shown. */
  const boardRates = board
    .map((m) => {
      const mt = total(m.days);
      return costPerKiloLine(mt.cost, mt.linesAdded);
    })
    .filter((r): r is number => r !== null);
  const boardRate =
    boardRates.length > 0 ? boardRates.reduce((a, b) => a + b, 0) / boardRates.length : null;
  const rateCeiling = Math.max(1, ...boardRates, rate ?? 0) * 1.2;

  const topModel = member.mix[0];
  const topModelPc = topModel ? Math.round((topModel[1] / Math.max(1, mixTotal)) * 100) : 0;
  const streak = streakOf(member.days);

  return (
    <Shell active={`/u/${viewer.username}`} pot={pot} members={board.length} me={viewer}>
      <HueDrift hue={member.hue} />
      <section className="view on" id="lineup">
        <div className="bevel">
          <div className="bgrid">
            <div className="bt bid">
              <div className="top">
                {member.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className="bav" src={member.avatarUrl} alt="" />
                ) : (
                  <span className="bav" />
                )}
                <div>
                  <h1>{member.displayName ?? member.username}</h1>
                  {rank > 0 && (
                    <span className={rank === 1 ? "rank first" : "rank"}>
                      {rank === 1 && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src="/coin-gold.png" alt="" aria-hidden="true" />
                      )}
                      rank {rank} of {ranked.length}
                    </span>
                  )}
                </div>
              </div>
              <Chips>
                <Chip tone="n">
                  {member.devices.length} machine{member.devices.length === 1 ? "" : "s"}
                </Chip>
                <Chip tone="n">{t.peak} agents at peak</Chip>
                <Chip tone="n">{t.active} of 30 days</Chip>
              </Chips>
            </div>
            <Tile icon="cursor" title="Spend" span={2}>
              <Fig v={usd(t.cost)} />
              <Sub>{share}% of the ${Math.round(pot).toLocaleString("en-US")} pool</Sub>
              <SegBar costs={days.map((d) => d.cost)} />
              <Chips>
                <Chip tone="n">{t.active} of 30 days active</Chip>
                {streak > 0 && <Chip tone="up">{streak} day streak</Chip>}
              </Chips>
            </Tile>

            <Tile icon="spark" title="Cost per 1,000 lines">
              <Fig v={rate === null ? "—" : usd(rate)} />
              <Sub>
                {boardRate === null ? "no board average yet" : `board average ${usd(boardRate)}`}
              </Sub>
              {rate !== null && (
                <ScaleBar pct={(rate / rateCeiling) * 100} left="efficient" right="wasteful" />
              )}
            </Tile>

            <Tile icon="check" title="Days worked">
              <Fig v={String(t.active)} u="of 30" />
              <Sub>longest quiet stretch {dur(quiet)}</Sub>
              <Chips>
                <Chip tone="n">{today.cost > 0 ? `${usd(today.cost)} today` : "nothing today"}</Chip>
              </Chips>
            </Tile>


            <Tile icon="spark" title="Tokens burned">
              <Fig v={sci(t.tokens)} />
              <Sub>across {t.sessions} sessions</Sub>
              <Chips>
                <Chip tone="n">{t.interactive} you opened</Chip>
              </Chips>
            </Tile>

            <Tile icon="check" title="Lines written">
              <Fig v={t.linesAdded > 0 ? t.linesAdded.toLocaleString("en-US") : "—"} />
              <Sub>
                {t.linesAdded > 0
                  ? `${t.commits} commits · ${t.projects} projects`
                  : isSelf
                    ? "run tokenmax to fill this in"
                    : "not synced"}
              </Sub>
            </Tile>

            <div className="bpair w4">
              <Tile icon="rocket" title="This month at a glance">
                <div className="brings col">
                  <Ring
                    pct={(t.active / 30) * 100}
                    colour="var(--bv-lime)"
                    value={`${Math.round((t.active / 30) * 100)}%`}
                    label="Days worked"
                    note={`${t.active} of 30`}
                  />
                  <Ring
                    pct={share}
                    colour="var(--bv-orange)"
                    value={`${share}%`}
                    label="Pool share"
                    note={`of ${board.length} members`}
                  />
                  <Ring
                    pct={topModelPc}
                    colour="var(--bv-peri)"
                    value={`${topModelPc}%`}
                    label={topModel ? topModel[0].replace(/^claude-/, "") : "no models"}
                    note="of all tokens"
                  />
                </div>
              </Tile>
              <div className="bt bscope scope">
                <div className="bth">
                  <Sticker kind="cursor" />
                  Daily spend
                </div>
                <Scope
                  series={[{ user: member.username, costs: days.map((d) => d.cost), lit: true }]}
                  dates={days.map((d) => d.date)}
                />
              </div>
            </div>

            <Tile icon="spark" title="Model mix" span={2}>
              <Sub>share of {sci(t.tokens)} tokens</Sub>
              {member.mix.length === 0 ? (
                <Sub>no models reported yet</Sub>
              ) : (
                <>
                  <div className="bmix">
                    {member.mix.slice(0, 3).map(([model, tokens], i) => (
                      <i
                        key={model}
                        style={{
                          flex: Math.max(1, Math.round((tokens / Math.max(1, mixTotal)) * 100)),
                          background: ["var(--bv-peri)", "var(--bv-lime)", "var(--bv-cyan)"][i],
                        }}
                      />
                    ))}
                  </div>
                  <div className="bmixleg">
                    {member.mix.slice(0, 3).map(([model, tokens], i) => (
                      <span key={model}>
                        <s style={{ background: ["var(--bv-peri)", "var(--bv-lime)", "var(--bv-cyan)"][i] }} />
                        <b>{Math.round((tokens / Math.max(1, mixTotal)) * 100)}%</b> {model}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Tile>

            <Tile icon="rocket" title="Agents at once">
              <Fig v={String(t.peak)} />
              <Sub>peak concurrent this window</Sub>
            </Tile>

            <Tile icon="check" title="Sessions">
              <Fig v={String(t.sessions)} />
              <Sub>{t.interactive} you opened yourself</Sub>
            </Tile>

            {/* A machine name is the owner's business and nobody else's. */}
            {isSelf && (
              <Tile icon="rocket" title="Your machines" span={4}>
                <div className="brigs">
                  {member.devices.length === 0 && <Sub>nothing reporting yet</Sub>}
                  {member.devices.map((d) => (
                    <div className="brig" key={d.name + d.lastSeenAt}>
                      <span className="n">{d.name}</span>
                      <span className="a">last seen {d.lastSeenAt.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </Tile>
            )}
          </div>

          <footer className="bwm">
          <span className="bwmk">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/coin.png" srcSet="/coin.png 1x, /coin@2x.png 2x" alt="" aria-hidden="true" />
            <b>tokenmax</b>
          </span>
          <span>spend is api list-price equivalent, not billed</span>
        </footer>
        </div>
      </section>
    </Shell>
  );
}
