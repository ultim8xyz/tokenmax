import { describe, expect, it } from "bun:test";
import { localDate, maxConcurrent, summarize, type Turn } from "../src/lib/sessions.js";

const TTL = 900; // 15 minutes
const T0 = Date.parse("2026-08-23T10:00:00Z");

function turn(session: string, minutes: number, project = "/repo", interactive = true): Turn {
  return { session, project, at: T0 + minutes * 60_000, interactive };
}

describe("maxConcurrent", () => {
  it("is zero with no turns", () => {
    expect(maxConcurrent([], TTL)).toBe(0);
  });

  it("counts one long session once, not once per turn", () => {
    const turns = [0, 5, 10, 14, 20].map((m) => turn("a", m));
    expect(maxConcurrent(turns, TTL)).toBe(1);
  });

  it("counts sessions overlapping inside the TTL", () => {
    expect(maxConcurrent([turn("a", 0), turn("b", 5)], TTL)).toBe(2);
  });

  it("does not count sessions separated by more than the TTL", () => {
    expect(maxConcurrent([turn("a", 0), turn("b", 20)], TTL)).toBe(1);
  });

  it("does not count a session that ends exactly as another begins", () => {
    expect(maxConcurrent([turn("a", 0), turn("b", 15)], TTL)).toBe(1);
  });

  it("finds the peak, not the count at the end", () => {
    const turns = [turn("a", 0), turn("b", 1), turn("c", 2), turn("d", 60)];
    expect(maxConcurrent(turns, TTL)).toBe(3);
  });

  it("re-opens a session that went quiet past the TTL", () => {
    // 'a' is live at 0 and again at 60; 'b' only overlaps the second stretch.
    expect(maxConcurrent([turn("a", 0), turn("a", 60), turn("b", 62)], TTL)).toBe(2);
  });
});

describe("summarize", () => {
  const turns = [
    turn("a", 0),
    turn("a", 30),
    turn("b", 5, "/other"),
    turn("c", 200, "/repo", false),
  ];

  it("counts distinct sessions and projects", () => {
    const [day] = summarize(turns, TTL);
    expect(day!.sessions).toBe(3);
    expect(day!.projects).toBe(2);
  });

  it("separates your terminal sessions from agent-spawned ones", () => {
    const [day] = summarize(turns, TTL);
    expect(day!.interactiveSessions).toBe(2);
  });

  it("reports the largest quiet stretch inside the day", () => {
    const [day] = summarize(turns, TTL);
    // 30min -> 200min is the widest gap between consecutive turns.
    expect(day!.maxGapSeconds).toBe(170 * 60);
  });

  it("brackets the day with its first and last turn", () => {
    const [day] = summarize(turns, TTL);
    expect(day!.firstActivityAt).toBe(new Date(T0).toISOString());
    expect(day!.lastActivityAt).toBe(new Date(T0 + 200 * 60_000).toISOString());
  });

  it("splits turns across local days", () => {
    const spread = [turn("a", 0), turn("b", 60 * 30)];
    const days = summarize(spread, TTL);
    expect(days.length).toBe(2);
    expect(days[0]!.date < days[1]!.date).toBe(true);
  });
});

describe("localDate", () => {
  it("agrees with the machine's own calendar day", () => {
    const at = Date.parse("2026-08-23T10:00:00Z");
    const expected = new Date(at).toLocaleDateString("sv-SE");
    expect(localDate(at)).toBe(expected);
  });
});
