import { requireMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { loadBoardSummary } from "@/lib/console/load";
import { Shell } from "../console/shell";
import { Sub, Tile } from "../console/bevel";
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

  const roster = members ?? [];

  return (
    <Shell active="/settings" pot={summary.pot} members={summary.members} me={member}>
      <section className="view on" id="settings">
        <div className="bevel">
          <div className="bhead">
            <div>
              <h1>Settings</h1>
              <div className="bm">signed in as {member.username}</div>
            </div>
          </div>

          <div className="bgrid">
            {/* The controls keep their own markup and behaviour; only the
                surface around them is the product's. */}
            <Tile icon="check" title="Display name" span={2}>
              <AliasRow username={member.username} initial={member.displayName} />
            </Tile>

            <Tile icon="rocket" title="Add a machine" span={2}>
              <MachineRow />
            </Tile>

            {member.role === "owner" && (
              <Tile icon="spark" title="Members" span={4}>
                {roster.length === 0 ? (
                  <Sub>nobody yet</Sub>
                ) : (
                  <div className="brigs">
                    {roster.map((m) => (
                      <div className="brig" key={m.username as string}>
                        <span className="n">@{m.username as string}</span>
                        <span className="a">
                          {m.onboarded_at ? (m.role as string) : "not synced"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Tile>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
