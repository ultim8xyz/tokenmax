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

  return (
    <Shell active="/" me={me}>
      <HueDrift hue={members[0]?.hue ?? 210} />
      <Board members={members} initial={parseWindow(w)} />
    </Shell>
  );
}
