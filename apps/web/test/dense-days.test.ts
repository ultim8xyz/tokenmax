import { describe, expect, it } from "bun:test";
import { denseDays } from "../lib/console/board";

const TODAY = new Date("2026-08-24T12:00:00Z");

describe("denseDays", () => {
  it("carries the date of every point", () => {
    // The chart labels the start of the window from days[0].date. When that
    // property did not exist, the canvas painted the string "undefined".
    const series = denseDays([], 30, TODAY);
    expect(series).toHaveLength(30);
    expect(series[0].date).toBe("2026-07-26");
    expect(series[29].date).toBe("2026-08-24");
    expect(series.every((d) => typeof d.date === "string" && d.date.length > 0)).toBe(true);
  });

  it("zero-fills missing days and keeps the ones it has", () => {
    const series = denseDays(
      [{ usage_date: "2026-08-24", cost_usd: 84.12 } as never],
      3,
      TODAY,
    );
    expect(series).toEqual([
      { date: "2026-08-22", cost: 0 },
      { date: "2026-08-23", cost: 0 },
      { date: "2026-08-24", cost: 84.12 },
    ]);
  });
});
