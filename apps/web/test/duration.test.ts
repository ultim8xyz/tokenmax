import { describe, expect, it } from "bun:test";
import { dur } from "../lib/console/board";

describe("dur", () => {
  it.each([
    [0, "0m"],
    [90, "2m"],
    [3599, "60m"],
    [3600, "1.0h"],
    [75_720, "21.0h"],
    [86_399, "24.0h"],
    [86_400, "1.0d"],
    [455_040, "5.3d"],
  ])("formats %p as %p", (seconds, expected) => {
    expect(dur(seconds)).toBe(expected);
  });
});
