import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { resolveRange, type PushOptions } from "../src/commands/push.js";
import type { Config } from "../src/config.js";

const TODAY = new Date("2026-08-23T12:00:00Z");
const base: Config = { token: "t", username: null, device_id: "d", device_name: "n" };

describe("resolveRange", () => {
  it("treats an explicit date as a single day", () => {
    expect(resolveRange({ date: "2026-08-01" }, base, TODAY)).toEqual({
      since: "2026-08-01",
      until: "2026-08-01",
    });
  });

  it("counts --days back from today inclusive", () => {
    expect(resolveRange({ days: 3 }, base, TODAY)).toEqual({
      since: "2026-08-21",
      until: "2026-08-23",
    });
  });

  it("falls back to the 30-day floor on a first sync", () => {
    expect(resolveRange({}, base, TODAY)).toEqual({ since: "2026-07-24", until: "2026-08-23" });
  });

  it("re-sends the last pushed day, which may have grown", () => {
    expect(resolveRange({}, { ...base, last_push_date: "2026-08-20" }, TODAY)).toEqual({
      since: "2026-08-20",
      until: "2026-08-23",
    });
  });

  it("clamps a stale last_push_date to the floor", () => {
    expect(resolveRange({}, { ...base, last_push_date: "2025-01-01" }, TODAY)).toEqual({
      since: "2026-07-24",
      until: "2026-08-23",
    });
  });

  it.each([{ days: 0 }, { days: 31 }, { days: 1.5 }, { date: "23-08-2026" }])(
    "rejects %o",
    (options: PushOptions) => {
      expect(() => resolveRange(options, base, TODAY)).toThrow();
    },
  );
});

describe("resolveRange across a timezone-dependent day boundary", () => {
  // `bun test` pins TZ=UTC, which is exactly the setting where a UTC-based and a
  // local-based implementation agree — so the boundary has to be forced here or
  // the assertions below are vacuous.
  const ZONE = "America/New_York";
  const original = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = ZONE;
  });
  afterEach(() => {
    process.env.TZ = original;
  });

  // 23:41 on the 28th in New York is already the 29th in UTC. Resolving in UTC
  // stamps last_push_date a day ahead and drops the evening just worked.
  const evening = () => new Date(Date.UTC(2026, 7, 29, 3, 41));

  it("uses the local day, not the UTC one", () => {
    expect(resolveRange({}, { ...base, last_push_date: "2026-08-28" }, evening())).toEqual({
      since: "2026-08-28",
      until: "2026-08-28",
    });
  });

  it("counts --days back in local days", () => {
    expect(resolveRange({ days: 2 }, base, evening())).toEqual({
      since: "2026-08-27",
      until: "2026-08-28",
    });
  });

  // 23:30 on Nov 3 is Nov 4 in UTC, and the window reaches back over the end of
  // DST, so a UTC-based shift lands a day short and skips Oct 30 entirely.
  it("shifts back across a DST boundary without losing a day", () => {
    expect(resolveRange({ days: 5 }, base, new Date(Date.UTC(2026, 10, 4, 4, 30)))).toEqual({
      since: "2026-10-30",
      until: "2026-11-03",
    });
  });
});
