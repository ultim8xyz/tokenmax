import { apiRequest } from "../lib/api.js";
import { collectDaily, type DailyEntry } from "../lib/ccusage.js";
import { collectTurns, summarize, type SessionStats } from "../lib/sessions.js";
import { authorEmail, collectLines, reposFrom, type DayLines } from "../lib/git.js";
import { getDeviceName, getMachineId, loadConfig, saveConfig, type Config } from "../config.js";
import { isInstalled, refresh } from "../lib/scheduler.js";
import { hookInstalled, installHook } from "../lib/hooks.js";

const MAX_BACKFILL_DAYS = 30;

export interface PushOptions {
  date?: string;
  days?: number;
  dryRun?: boolean;
}

export interface Entry extends DailyEntry {
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  sessions: number;
  interactiveSessions: number;
  projects: number;
  maxConcurrentSessions: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  maxGapSeconds: number;
}

const EMPTY_SESSIONS = {
  linesAdded: 0,
  linesRemoved: 0,
  commits: 0,
  sessions: 0,
  interactiveSessions: 0,
  projects: 0,
  maxConcurrentSessions: 0,
  firstActivityAt: null,
  lastActivityAt: null,
  maxGapSeconds: 0,
};

const EMPTY_USAGE = {
  agents: [] as string[],
  models: [] as string[],
  inputTokens: 0,
  outputTokens: 0,
  reasoningOutputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  costUSD: 0,
  modelBreakdown: [],
};

/** Outer join on date: a day can have transcripts with no priced usage (a
 *  session that only read files) or priced usage with no transcripts left. */
export function mergeByDate(
  usage: DailyEntry[],
  sessions: SessionStats[],
  lines: DayLines[] = [],
): Entry[] {
  const byDate = new Map<string, Entry>();

  for (const entry of usage) {
    byDate.set(entry.date, { ...entry, ...EMPTY_SESSIONS });
  }
  for (const stat of sessions) {
    const existing = byDate.get(stat.date) ?? { date: stat.date, ...EMPTY_USAGE, ...EMPTY_SESSIONS };
    byDate.set(stat.date, {
      ...existing,
      sessions: stat.sessions,
      interactiveSessions: stat.interactiveSessions,
      projects: stat.projects,
      maxConcurrentSessions: stat.maxConcurrentSessions,
      firstActivityAt: stat.firstActivityAt,
      lastActivityAt: stat.lastActivityAt,
      maxGapSeconds: stat.maxGapSeconds,
    });
  }

  for (const day of lines) {
    const existing = byDate.get(day.date) ?? { date: day.date, ...EMPTY_USAGE, ...EMPTY_SESSIONS };
    byDate.set(day.date, {
      ...existing,
      linesAdded: day.linesAdded,
      linesRemoved: day.linesRemoved,
      commits: day.commits,
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface SubmitResponse {
  accepted: number;
  totals: { cost_usd: number; total_tokens: number };
  devices: { device_name: string; cost_usd: number }[];
}

/**
 * Local, not UTC. ccusage and `localDate` in sessions.ts both bucket a day by
 * the wall clock, so a range resolved in UTC asks for the wrong day for anyone
 * not on it: west of UTC the date rolls over during the evening, `since` is
 * stamped a day ahead, and that evening's work is never queried again.
 */
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Explicit date > explicit day count > everything since the last push. */
export function resolveRange(options: PushOptions, config: Config, today = new Date()): {
  since: string;
  until: string;
} {
  const untilDate = isoDate(today);

  if (options.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error("--date must be YYYY-MM-DD");
    return { since: options.date, until: options.date };
  }

  if (options.days !== undefined) {
    if (!Number.isInteger(options.days) || options.days < 1 || options.days > MAX_BACKFILL_DAYS) {
      throw new Error(`--days must be between 1 and ${MAX_BACKFILL_DAYS}`);
    }
    return { since: isoDate(shiftDays(today, -(options.days - 1))), until: untilDate };
  }

  const floor = isoDate(shiftDays(today, -MAX_BACKFILL_DAYS));
  const last = config.last_push_date;
  // Re-send the last pushed day: it may have grown since the last sync.
  const since = last && last > floor ? last : floor;
  return { since, until: untilDate };
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function printEntries(entries: Entry[]): void {
  for (const entry of entries) {
    console.log(
      `  ${entry.date}  ${formatUsd(entry.costUSD).padStart(9)}  ` +
        `${formatTokens(entry.totalTokens).padStart(7)}  ` +
        `${String(entry.interactiveSessions).padStart(3)} yours / ` +
        `${String(entry.sessions).padStart(4)} total  ` +
        `${String(entry.projects).padStart(2)} proj  ` +
        `peak ${String(entry.maxConcurrentSessions).padStart(3)}  ` +
        `+${String(entry.linesAdded).padStart(6)} lines`,
    );
  }
}

/** Returns the number of days submitted; 0 when there was nothing to send. */
export async function pushCommand(options: PushOptions, apiUrl: string): Promise<number> {
  const config = loadConfig();
  // A dry run touches nothing but local files, so it works before you have an
  // instance to sign in to.
  if (!config && !options.dryRun) throw new Error("Not signed in. Run `tokenmax login`.");

  // No machine id is minted here: a dry run should leave no trace on disk.
  const identity: Config = config ?? {
    token: "",
    username: null,
    device_id: "",
    device_name: getDeviceName(),
  };

  const { since, until } = resolveRange(options, identity);
  const turns = await collectTurns(since, until);
  const authors = identity.git_authors?.length
    ? identity.git_authors
    : [await authorEmail()].filter((a): a is string => Boolean(a));

  const [usage, sessions, lines] = await Promise.all([
    collectDaily(since, until),
    Promise.resolve(summarize(turns)),
    // Repos come from the transcripts, so nothing has to be configured: if the
    // agent worked there, it is walked.
    reposFrom(turns).then((repos) => collectLines(repos, since, until, authors)),
  ]);
  const entries = mergeByDate(usage, sessions, lines);

  if (entries.length === 0) {
    console.log(`No usage found between ${since} and ${until}.`);
    return 0;
  }

  if (options.dryRun) {
    console.log(`\nWould submit ${entries.length} day(s) as ${identity.device_name}:`);
    printEntries(entries);
    const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
    const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
    console.log(
      `  ${"total".padEnd(10)} ${formatUsd(totalCost).padStart(9)}  ` +
        `${formatTokens(totalTokens).padStart(7)}`,
    );
    console.log(
      config ? "\n(dry run — nothing submitted)" : "\n(dry run — not signed in, nothing submitted)",
    );
    return entries.length;
  }

  const device = identity.device_id || getMachineId();
  const response = await apiRequest<SubmitResponse>(apiUrl, identity, "/api/usage/submit", {
    method: "POST",
    body: JSON.stringify({
      device_id: device,
      device_name: identity.device_name,
      entries,
    }),
  });

  saveConfig({ ...identity, device_id: device, last_push_date: until });

  // Every scheduled run and every session hook lands here, so this is where a
  // machine gets to notice its own schedule is out of date and repair it
  // without anyone being told to run a command.
  if (isInstalled() && !hookInstalled()) installHook();
  if (refresh()) console.log("\nSchedule updated to the current version.");

  console.log(`\nSynced ${response.accepted} day(s) from ${identity.device_name}:`);
  printEntries(entries);

  if (response.devices.length > 1) {
    console.log("\nProfile total across devices:");
    for (const device of response.devices) {
      console.log(`  ${device.device_name.padEnd(20)} ${formatUsd(device.cost_usd)}`);
    }
    console.log(
      `  ${"all".padEnd(20)} ${formatUsd(response.totals.cost_usd)} ` +
        `(${formatTokens(response.totals.total_tokens)} tokens)`,
    );
  }

  return response.accepted;
}
