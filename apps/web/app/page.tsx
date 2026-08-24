import { requireMember } from "@/lib/auth";
import { loadBoard } from "@/lib/console/load";
import { parseWindow, total, usd0 } from "@/lib/console/board";
import { Shell } from "./console/shell";
import { HueDrift } from "./console/hue";
import { Board } from "./board";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const me = await requireMember("/");
  const { w } = await searchParams;
  const members = await loadBoard();
  const pot = usd0(members.reduce((a, m) => a + total(m.days).cost, 0));

  return (
    <Shell active="/" pot={pot} members={members.length} me={me}>
      <HueDrift hue={members[0]?.hue ?? 210} />
      <Board members={members} initial={parseWindow(w)} />
    </Shell>
  );
}
