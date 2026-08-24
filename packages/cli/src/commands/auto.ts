import { existsSync, readFileSync } from "node:fs";
import { LOG_PATH, install, isInstalled, schedulerFor, uninstall } from "../lib/scheduler.js";

/** Shows, installs, or removes the daily push. */
export function autoCommand(off: boolean): void {
  if (off) {
    uninstall();
    console.log("Daily sync removed.");
    return;
  }

  if (!isInstalled()) {
    const scheduler = install();
    console.log(
      scheduler ? `Daily sync installed (${scheduler}).` : "No scheduler on this platform.",
    );
    return;
  }

  console.log(`Daily sync is on (${schedulerFor() ?? "unknown"}).`);
  if (existsSync(LOG_PATH)) {
    const lines = readFileSync(LOG_PATH, "utf-8").trimEnd().split("\n").slice(-5);
    console.log("\nLast run:");
    for (const line of lines) console.log(`  ${line}`);
  }
}
