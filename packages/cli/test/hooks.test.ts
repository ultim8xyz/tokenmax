import { describe, expect, test } from "bun:test";
import { HOOK_COMMAND, isOurs } from "../src/lib/hooks";

const group = (command: string) => ({ hooks: [{ type: "command", command }] });

describe("isOurs", () => {
  test("matches the absolute form older versions wrote", () => {
    expect(isOurs(group("/bin/sh /Users/someone/.tokenmax/auto-push.sh"))).toBe(true);
  });
  test("matches the $HOME and ~ forms", () => {
    expect(isOurs(group("/bin/sh $HOME/.tokenmax/auto-push.sh"))).toBe(true);
    expect(isOurs(group("/bin/sh ~/.tokenmax/auto-push.sh"))).toBe(true);
  });
  test("matches what installHook writes", () => {
    expect(isOurs(group(HOOK_COMMAND))).toBe(true);
  });
  test("leaves other hooks alone", () => {
    expect(isOurs(group("$HOME/.claude/hooks/router.sh"))).toBe(false);
    expect(isOurs({ hooks: [] })).toBe(false);
  });
});

test("installHook writes a portable path", () => {
  expect(HOOK_COMMAND).not.toContain("/Users/");
  expect(HOOK_COMMAND).toContain("$HOME/.tokenmax/auto-push.sh");
});
