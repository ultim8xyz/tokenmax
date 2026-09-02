import { requireMember } from "@/lib/auth";
import { loadBoard } from "@/lib/console/load";
import { parseWindow } from "@/lib/console/board";
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
  const window = parseWindow(w);

  return (
    <Shell active="/" me={me}>
      <HueDrift hue={members[0]?.hue ?? 210} />
      {/* Keyed by the window so a navigation that only changes the search param
          remounts the board. React keeps client state across those, so coming
          back to "/" from "/?w=30d" left the URL saying 7 days while the board
          still showed 30, and a refresh silently flipped it. */}
      <Board key={window} members={members} initial={window} />
    </Shell>
  );
}
