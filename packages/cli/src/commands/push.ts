import { apiRequest } from "../lib/api.js";
import { collectDaily, type DailyEntry } from "../lib/ccusage.js";
import { collectSessions, type SessionStats } from "../lib/sessions.js";
import { getDeviceName, getMachineId, loadConfig, saveConfig, type Config } from "../config.js";

const MAX_BACKFILL_DAYS = 30;

export interface PushOptions {
  date?: string;
  days?: number;
  dryRun?: boolean;
}

export interface Entry extends DailyEntry {
  sessions: number;
  interactiveSessions: number;
  projects: number;
  maxConcurrentSessions: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  maxGapSeconds: number;
}

const EMPTY_SESSIONS = {
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
export function mergeByDate(usage: DailyEntry[], sessions: SessionStats[]): Entry[] {
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

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface SubmitResponse {
  accepted: number;
  totals: { cost_usd: number; total_tokens: number };
  devices: { device_name: string; cost_usd: number }[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
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
        `peak ${String(entry.maxConcurrentSessions).padStart(3)}`,
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
  const [usage, sessions] = await Promise.all([
    collectDaily(since, until),
    collectSessions(since, until),
  ]);
  const entries = mergeByDate(usage, sessions);

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
