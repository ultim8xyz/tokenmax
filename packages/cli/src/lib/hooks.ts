import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { SCRIPT_PATH } from "./scheduler.js";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
/** Long enough for a cold `npx` fetch, short enough not to hang a quit. */
const TIMEOUT_SECONDS = 120;

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
  async?: boolean;
}

interface HookGroup {
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

function isOurs(group: HookGroup): boolean {
  return group.hooks?.some((h) => h.command?.includes(SCRIPT_PATH)) ?? false;
}

function read(): Settings | null {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as Settings;
  } catch {
    // Refusing to touch a file we cannot parse: rewriting it would lose
    // whatever else is in there.
    return null;
  }
}

function write(settings: Settings): void {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

export function hookInstalled(): boolean {
  const settings = read();
  return (settings?.hooks?.SessionEnd ?? []).some(isOurs);
}

/**
 * Pushes when a Claude Code session ends.
 *
 * A daily job means a day of lag; this is the difference between a leaderboard
 * and a history. Async, so nothing waits on the network to close a session.
 *
 * Returns false when settings.json exists but cannot be parsed.
 */
export function installHook(): boolean {
  const settings = read();
  if (!settings) return false;

  settings.hooks ??= {};
  settings.hooks.SessionEnd ??= [];
  if (settings.hooks.SessionEnd.some(isOurs)) return true;

  settings.hooks.SessionEnd.push({
    hooks: [
      { type: "command", command: `/bin/sh ${SCRIPT_PATH}`, timeout: TIMEOUT_SECONDS, async: true },
    ],
  });
  write(settings);
  return true;
}

export function uninstallHook(): void {
  const settings = read();
  if (!settings?.hooks?.SessionEnd) return;

  settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter((g) => !isOurs(g));
  if (settings.hooks.SessionEnd.length === 0) delete settings.hooks.SessionEnd;
  write(settings);
}
