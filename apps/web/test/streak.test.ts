import { describe, expect, it } from "bun:test";
import { streakFrom } from "../lib/streak";

const TODAY = new Date("2026-08-23T12:00:00Z");

describe("streakFrom", () => {
  it("counts consecutive days ending today", () => {
    expect(streakFrom(new Set(["2026-08-23", "2026-08-22"]), TODAY)).toBe(2);
  });

  it("counts back from yesterday when today has not synced yet", () => {
    expect(streakFrom(new Set(["2026-08-22", "2026-08-21"]), TODAY)).toBe(2);
  });

  it("stops at the first gap", () => {
    expect(streakFrom(new Set(["2026-08-23", "2026-08-21"]), TODAY)).toBe(1);
  });

  it("is zero with no history", () => {
    expect(streakFrom(new Set(), TODAY)).toBe(0);
  });
});
