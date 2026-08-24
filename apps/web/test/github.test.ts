import { describe, expect, it } from "bun:test";
import { normalizeGithubLogin } from "../lib/github";

describe("normalizeGithubLogin", () => {
  it.each([
    ["ohong", "ohong"],
    ["OHong", "ohong"],
    ["  ohong  ", "ohong"],
    ["@ohong", "ohong"],
    ["a-b-c", "a-b-c"],
    ["a".repeat(39), "a".repeat(39)],
  ])("accepts %p", (input, expected) => {
    expect(normalizeGithubLogin(input)).toBe(expected);
  });

  it.each([
    "",
    "-leading",
    "trailing-",
    "double--hyphen",
    "has space",
    "has/slash",
    "has.dot",
    "a".repeat(40),
    "'; drop table profiles; --",
  ])("rejects %p", (input) => {
    expect(normalizeGithubLogin(input)).toBeNull();
  });

  // Wrapped one level deeper: it.each spreads a bare array as the arg list.
  it.each([[null], [undefined], [42], [{}], [["ohong"]]])(
    "rejects the non-string %p",
    (input) => {
      expect(normalizeGithubLogin(input)).toBeNull();
    },
  );
});
