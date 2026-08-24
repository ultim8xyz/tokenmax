import { requireMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { loadBoardSummary } from "@/lib/console/load";
import { usd0 } from "@/lib/console/board";
import { Shell } from "../console/shell";
import { AliasRow, MachineRow } from "./controls";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const member = await requireMember("/settings");
  const service = getServiceClient();

  // Settings shows no numbers, so it does not read the board. Loading it here
  // cost two more round trips on a page that displays neither.
  const [{ data: members }, summary] = await Promise.all([
    member.role === "owner"
      ? service.from("profiles").select("username, role, onboarded_at").order("created_at")
      : Promise.resolve({ data: null }),
    loadBoardSummary(),
  ]);

  return (
    <Shell active="/settings" pot={usd0(summary.pot)} members={summary.members} me={member}>
      <section className="view on" id="settings">
        <div className="setwrap">
          <div className="rows rise" style={{ "--i": 0 } as React.CSSProperties}>
            <AliasRow username={member.username} initial={member.displayName} />
            <MachineRow />
          </div>

          <div className="feed rise" style={{ "--i": 2 } as React.CSSProperties}>
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
