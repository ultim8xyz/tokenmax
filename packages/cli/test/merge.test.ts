import { describe, expect, it } from "bun:test";
import { mergeByDate } from "../src/commands/push.js";
import type { DailyEntry } from "../src/lib/ccusage.js";
import type { SessionStats } from "../src/lib/sessions.js";

function usage(date: string, costUSD: number): DailyEntry {
  return {
    date,
    agents: ["claude"],
    models: ["claude-opus-5"],
    inputTokens: 1,
    outputTokens: 1,
    reasoningOutputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 2,
    costUSD,
    modelBreakdown: [],
  };
}

function stats(date: string, sessions: number): SessionStats {
  return {
    date,
    sessions,
    interactiveSessions: 1,
    projects: 2,
    maxConcurrentSessions: 3,
    firstActivityAt: `${date}T09:00:00.000Z`,
    lastActivityAt: `${date}T17:00:00.000Z`,
    maxGapSeconds: 600,
  };
}

describe("mergeByDate", () => {
  it("joins the two collectors on the same day", () => {
    const [day] = mergeByDate([usage("2026-08-23", 10)], [stats("2026-08-23", 5)]);
    expect(day!.costUSD).toBe(10);
    expect(day!.sessions).toBe(5);
    expect(day!.maxConcurrentSessions).toBe(3);
  });

  it("keeps a priced day that has no transcripts left", () => {
    const [day] = mergeByDate([usage("2026-08-23", 10)], []);
    expect(day!.costUSD).toBe(10);
    expect(day!.sessions).toBe(0);
    expect(day!.firstActivityAt).toBeNull();
  });

  it("keeps a transcript day that produced no priced usage", () => {
    const [day] = mergeByDate([], [stats("2026-08-23", 5)]);
    expect(day!.costUSD).toBe(0);
    expect(day!.totalTokens).toBe(0);
    expect(day!.sessions).toBe(5);
  });

  it("returns days in date order", () => {
    const merged = mergeByDate(
      [usage("2026-08-23", 1), usage("2026-08-21", 1)],
      [stats("2026-08-22", 1)],
    );
    expect(merged.map((d) => d.date)).toEqual(["2026-08-21", "2026-08-22", "2026-08-23"]);
  });
});
