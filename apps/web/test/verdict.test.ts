import { describe, expect, it } from "bun:test";
import { BEAST_THRESHOLD_USD, verdictFor } from "../lib/console/verdict";

describe("verdictFor", () => {
  it("is generous exactly at the threshold", () => {
    expect(verdictFor(BEAST_THRESHOLD_USD).beast).toBe(true);
  });

  it("is not generous a cent below it", () => {
    expect(verdictFor(BEAST_THRESHOLD_USD - 0.01).beast).toBe(false);
  });

  it.each([[0], [1], [999.99]])("nudges at %p", (spend) => {
    expect(verdictFor(spend).headline).toBe("Gotta step your game up.");
  });

  it.each([[1000], [5000]])("salutes at %p", (spend) => {
    expect(verdictFor(spend).headline).toBe("You're a beast.");
  });
});
