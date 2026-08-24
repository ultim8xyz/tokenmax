import { describe, expect, it } from "bun:test";
import { parseLog } from "../src/lib/git.js";

const HEAD = "@@C@@";
const SEP = "@@T@@";
const CLAUDE = "Claude Opus 5 <noreply@anthropic.com>";

function commit(iso: string, trailers: string, stats: string[]): string {
  return [`${HEAD}${iso}${SEP}${trailers}`, ...stats, ""].join("\n");
}

describe("parseLog", () => {
  it("counts an agent-assisted commit", () => {
    const out = parseLog(commit("2026-08-24T10:00:00-04:00", CLAUDE, ["12\t3\tsrc/a.ts"]));
    const day = [...out.values()][0]!;
    expect(day.linesAdded).toBe(12);
    expect(day.linesRemoved).toBe(3);
    expect(day.commits).toBe(1);
  });

  it("ignores a commit with no trailer", () => {
    expect(parseLog(commit("2026-08-24T10:00:00-04:00", "", ["99\t0\tsrc/a.ts"])).size).toBe(0);
  });

  it("ignores a trailer that is not Claude", () => {
    const out = parseLog(
      commit("2026-08-24T10:00:00-04:00", "Someone <me@example.com>", ["99\t0\ta.ts"]),
    );
    expect(out.size).toBe(0);
  });

  it("adds up several files and several commits on a day", () => {
    const out = parseLog(
      commit("2026-08-24T09:00:00-04:00", CLAUDE, ["10\t1\ta.ts", "5\t2\tb.ts"]) +
        commit("2026-08-24T18:00:00-04:00", CLAUDE, ["7\t0\tc.ts"]),
    );
    const day = [...out.values()][0]!;
    expect(day.linesAdded).toBe(22);
    expect(day.linesRemoved).toBe(3);
    expect(day.commits).toBe(2);
  });

  it("skips binary files, which report a dash rather than a count", () => {
    const out = parseLog(commit("2026-08-24T10:00:00-04:00", CLAUDE, ["-\t-\tlogo.png", "4\t0\ta.ts"]));
    expect([...out.values()][0]!.linesAdded).toBe(4);
  });

  it("does not leak stats from a skipped commit into the next one", () => {
    const out = parseLog(
      commit("2026-08-23T10:00:00-04:00", "", ["500\t0\thand-written.ts"]) +
        commit("2026-08-24T10:00:00-04:00", CLAUDE, ["4\t0\ta.ts"]),
    );
    expect(out.size).toBe(1);
    expect([...out.values()][0]!.linesAdded).toBe(4);
  });

  it("is empty for empty input", () => {
    expect(parseLog("").size).toBe(0);
  });
});
