import { existsSync, readFileSync } from "node:fs";
import { LOG_PATH, install, isInstalled, schedulerFor, uninstall } from "../lib/scheduler.js";
import { hookInstalled, installHook, uninstallHook } from "../lib/hooks.js";

/** Shows, installs, or removes the automatic push. */
export function autoCommand(off: boolean): void {
  if (off) {
    uninstall();
    uninstallHook();
    console.log("Automatic sync removed.");
    return;
  }

  if (!isInstalled()) install();
  if (!hookInstalled()) installHook();

  console.log(`Daily job:    ${isInstalled() ? `on (${schedulerFor() ?? "unknown"}, 21:00)` : "off"}`);
  console.log(`Session hook: ${hookInstalled() ? "on (after every Claude Code session)" : "off"}`);

  if (existsSync(LOG_PATH)) {
    const lines = readFileSync(LOG_PATH, "utf-8").trimEnd().split("\n").slice(-6);
    console.log("\nLast run:");
    for (const line of lines) console.log(`  ${line}`);
  } else {
    console.log("\nNo run logged yet.");
  }
}
