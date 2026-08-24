import { describe, expect, it } from "bun:test";
import { MAX_DISPLAY_NAME, normalizeDisplayName } from "../lib/display-name";

describe("normalizeDisplayName", () => {
  it("keeps a real alias", () => {
    expect(normalizeDisplayName("Jax")).toBe("Jax");
  });

  it("trims surrounding space", () => {
    expect(normalizeDisplayName("  Jax  ")).toBe("Jax");
  });

  it.each([[""], ["   "], [null], [undefined]])(
    "treats %p as 'use my username'",
    (input) => {
      expect(normalizeDisplayName(input)).toBeNull();
    },
  );

  it("caps an over-long alias rather than rejecting it", () => {
    expect(normalizeDisplayName("x".repeat(100))).toHaveLength(MAX_DISPLAY_NAME);
  });

  it.each([[42], [{}], [["Jax"]], [true]])("rejects the non-string %p", (input) => {
    expect(normalizeDisplayName(input)).toBeUndefined();
  });
});
