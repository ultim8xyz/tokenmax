import { describe, expect, it } from "bun:test";
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
