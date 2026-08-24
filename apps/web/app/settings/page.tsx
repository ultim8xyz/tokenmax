import { requireMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { loadBoard } from "@/lib/console/load";
import { total, usd0 } from "@/lib/console/board";
import { installCommand } from "@/lib/console/cli";
import { Shell } from "../console/shell";
import { AliasRow, InviteRow, Toggle } from "./controls";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const member = await requireMember("/settings");
  const service = getServiceClient();

  const { data: invites } =
    member.role === "owner"
      ? await service.from("invites").select("github_login").order("created_at")
      : { data: null };

  const { data: members } =
    member.role === "owner"
      ? await service.from("profiles").select("username, role, onboarded_at").order("created_at")
      : { data: null };

  const board = await loadBoard();
  const pot = usd0(board.reduce((a, m) => a + total(m.days).cost, 0));

  return (
    <Shell active="/settings" pot={pot} members={board.length}>
      <section className="view on" id="settings">
        <div className="setwrap">
          <div className="rows rise" style={{ "--i": 0 } as React.CSSProperties}>
            <AliasRow username={member.username} initial={member.displayName} />
            <Toggle
              title="Show me on the leaderboard"
              detail="Off keeps your profile working and takes you off the board."
              initial={member.isListed}
            />
            {member.role === "owner" && (
              <InviteRow initial={(invites ?? []).map((i) => i.github_login as string)} />
            )}
          </div>

          <div className="feed rise" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="big">
              <div className="k">Add another machine</div>
              <div className="n" style={{ marginTop: 8 }}>
                Run this on any machine you code on. Each one gets its own id, so days are
                summed across them and a re-push replaces only that machine&apos;s row.
              </div>
              <div className="cmd" style={{ marginTop: 12 }}>
                <code>{installCommand()}</code>
              </div>
            </div>

            {member.role === "owner" && (
              <div className="big" style={{ marginTop: 14 }}>
                <div className="k">Members</div>
                <div className="rigs">
                  {(members ?? []).map((m) => (
                    <div className="rig" key={m.username as string}>
                      <span
                        className="d"
                        style={{
                          background: m.onboarded_at
                            ? "hsl(var(--hue) 96% 66%)"
                            : "rgba(150,166,205,0.34)",
                        }}
                      />
                      <span className="n">@{m.username as string}</span>
                      <span className="a">{m.onboarded_at ? (m.role as string) : "not synced"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
