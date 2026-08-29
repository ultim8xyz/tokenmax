import { existsSync, readFileSync } from "node:fs";
import {
  LOG_PATH,
  SCHEDULE_LABEL,
  install,
  isInstalled,
  schedulerFor,
  uninstall,
} from "../lib/scheduler.js";
import { hookInstalled, installHook, uninstallHook } from "../lib/hooks.js";

/** Shows, installs, or removes the automatic push. */
export function autoCommand(off: boolean): void {
  if (off) {
    uninstall();
    uninstallHook();
    console.log("Automatic sync removed.");
    return;
  }

  // Always reinstall rather than skipping when present: running this is how a
  // machine set up under an older version picks up a changed schedule.
  install();
  installHook();

  console.log(
    `Scheduled:    ${isInstalled() ? `on (${schedulerFor() ?? "unknown"}, ${SCHEDULE_LABEL})` : "off"}`,
  );
  console.log(`Session hook: ${hookInstalled() ? "on (after every Claude Code session)" : "off"}`);

  if (existsSync(LOG_PATH)) {
    const lines = readFileSync(LOG_PATH, "utf-8").trimEnd().split("\n").slice(-6);
    console.log("\nLast run:");
    for (const line of lines) console.log(`  ${line}`);
  } else {
    console.log("\nNo run logged yet.");
  }
}
