import { describe, expect, it } from "bun:test";
import { maxDowntimeSeconds, type ActivityDay } from "../lib/downtime";

function day(date: string, first: string, last: string, maxGapSeconds = 0): ActivityDay {
  return {
    usage_date: date,
    first_activity_at: `${date}T${first}:00.000Z`,
    last_activity_at: `${date}T${last}:00.000Z`,
    max_gap_seconds: maxGapSeconds,
  };
}

describe("maxDowntimeSeconds", () => {
  it("is zero with no history", () => {
    expect(maxDowntimeSeconds([])).toBe(0);
  });

  it("uses the within-day gap when it is the widest", () => {
    expect(maxDowntimeSeconds([day("2026-08-23", "09:00", "23:00", 6 * 3600)])).toBe(6 * 3600);
  });

  it("measures the stretch from one day's last turn to the next day's first", () => {
    const days = [day("2026-08-23", "09:00", "17:00"), day("2026-08-24", "09:00", "17:00")];
    expect(maxDowntimeSeconds(days)).toBe(16 * 3600);
  });

  it("widens across a day with no activity at all", () => {
    const days = [day("2026-08-23", "09:00", "17:00"), day("2026-08-25", "09:00", "17:00")];
    expect(maxDowntimeSeconds(days)).toBe(40 * 3600);
  });

  it("takes the larger of a within-day gap and a cross-day one", () => {
    const days = [
      day("2026-08-23", "09:00", "10:00", 30 * 3600),
      day("2026-08-24", "09:00", "17:00"),
    ];
    expect(maxDowntimeSeconds(days)).toBe(30 * 3600);
  });

  it("ignores days with no recorded activity window", () => {
    const days: ActivityDay[] = [
      { usage_date: "2026-08-22", first_activity_at: null, last_activity_at: null, max_gap_seconds: 0 },
      day("2026-08-23", "09:00", "17:00"),
      day("2026-08-24", "09:00", "17:00"),
    ];
    expect(maxDowntimeSeconds(days)).toBe(16 * 3600);
  });

  it("does not depend on input order", () => {
    const days = [day("2026-08-25", "09:00", "17:00"), day("2026-08-23", "09:00", "17:00")];
    expect(maxDowntimeSeconds(days)).toBe(40 * 3600);
  });
});
