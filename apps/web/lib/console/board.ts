import { isoDate, shiftDays } from "@/lib/streak";

export const WINDOWS = [
  { key: "1d", label: "Today", days: 1 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
] as const;

export type WindowKey = (typeof WINDOWS)[number]["key"];

export function parseWindow(value: unknown): WindowKey {
  return WINDOWS.some((w) => w.key === value) ? (value as WindowKey) : "7d";
}

export interface DayRow {
  usage_date: string;
  cost_usd: number;
  total_tokens: number;
  sessions: number;
  interactive_sessions: number;
  projects: number;
  max_concurrent_sessions: number;
  device_count: number;
  max_gap_seconds: number;
  lines_added: number;
  lines_removed: number;
  commits: number;
}

export interface MemberRow {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  hue: number;
  days: DayRow[];
}

export interface Totals {
  cost: number;
  tokens: number;
  sessions: number;
  interactive: number;
  projects: number;
  peak: number;
  devices: number;
  active: number;
  linesAdded: number;
  commits: number;
}

/** A stable hue per member, so a profile looks the same on every device. */
export function hueFor(username: string): number {
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function windowDays(days: DayRow[], window: WindowKey, today = new Date()): DayRow[] {
  const span = WINDOWS.find((w) => w.key === window)!.days;
  const since = isoDate(shiftDays(today, -(span - 1)));
  return days.filter((d) => d.usage_date >= since);
}

export function total(days: DayRow[]): Totals {
  const sum = (f: (d: DayRow) => number) => days.reduce((a, d) => a + f(d), 0);
  return {
    cost: sum((d) => Number(d.cost_usd)),
    tokens: sum((d) => Number(d.total_tokens)),
    sessions: sum((d) => Number(d.sessions)),
    interactive: sum((d) => Number(d.interactive_sessions)),
    projects: Math.max(0, ...days.map((d) => Number(d.projects)), 0),
    peak: Math.max(0, ...days.map((d) => Number(d.max_concurrent_sessions)), 0),
    devices: Math.max(0, ...days.map((d) => Number(d.device_count)), 0),
    active: days.filter((d) => Number(d.cost_usd) > 0).length,
    linesAdded: sum((d) => Number(d.lines_added ?? 0)),
    commits: sum((d) => Number(d.commits ?? 0)),
  };
}

/** Counts back from the most recent day, tolerating a today that has not synced. */
export function streakOf(days: DayRow[], today = new Date()): number {
  const live = new Set(days.filter((d) => Number(d.cost_usd) > 0).map((d) => d.usage_date));
  let cursor = live.has(isoDate(today)) ? today : shiftDays(today, -1);
  let n = 0;
  while (live.has(isoDate(cursor))) {
    n += 1;
    cursor = shiftDays(cursor, -1);
  }
  return n;
}

/**
 * Read out of behaviour rather than assigned, so the label means something.
 *
 * The design study's "Heavy" branch keyed on the share of tokens spent on the
 * big model; that needs per-model totals, which the daily rollup does not carry.
 * It is left out rather than faked.
 */
export function classOf(days: DayRow[]): [string, string] {
  const t = total(days);
  const perSession = t.cost / Math.max(1, t.sessions);

  if (t.peak >= 12) return ["Swarm", `${t.peak} agents alive at once`];
  if (t.active >= 27) return ["Metronome", `${t.active} of the last 30 days`];
  if (perSession > 4) return ["Deep", `$${perSession.toFixed(2)} a session`];
  if (t.devices >= 3) return ["Fleet", `${t.devices} machines reporting`];
  if (t.projects >= 8) return ["Broad", `${t.projects} projects in a day`];
  return ["Regular", `${t.active} days in 30`];
}

export interface SparkCell {
  level: string;
  /** Percent height, floored so an empty day still reads as a day. */
  height: number;
}

/** Fourteen cells — the shape of the fortnight without a second screen. */
export function sparkline(days: DayRow[], today = new Date()): SparkCell[] {
  const byDate = new Map(days.map((d) => [d.usage_date, Number(d.cost_usd)]));
  const cells = Array.from({ length: 14 }, (_, i) =>
    byDate.get(isoDate(shiftDays(today, i - 13))) ?? 0,
  );
  const peak = Math.max(1, ...cells);
  return cells.map((cost) => ({
    level: cost === 0 ? "" : cost > peak * 0.62 ? "hot" : "lit",
    height: Math.max(8, (cost / peak) * 100),
  }));
}

export interface DenseDay {
  date: string;
  cost: number;
}

/**
 * A dense 30-day series, zero-filled.
 *
 * The chart interpolates between points and divides by `length - 1`, so a
 * sparse or single-day series produces NaN and draws nothing. A new member has
 * exactly that, which is why the chart was blank rather than flat.
 */
export function denseDays(days: DayRow[], span = 30, today = new Date()): DenseDay[] {
  const byDate = new Map(days.map((d) => [d.usage_date, Number(d.cost_usd)]));
  return Array.from({ length: span }, (_, i) => {
    // The date was already computed here to key the lookup and then thrown
    // away, so the chart's start-of-window label read `undefined`. Kept.
    const date = isoDate(shiftDays(today, i - (span - 1)));
    return { date, cost: byDate.get(date) ?? 0 };
  });
}

export const usd = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const usd0 = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Scientific notation, which is the register a token count actually lives in.
 * Lives here beside the other formatters rather than in the chart module,
 * because a server component has to be able to call it too.
 */
export const sci = (n: number) => {
  if (n <= 0) return "0";
  const e = Math.floor(Math.log10(n));
  return `${(n / 10 ** e).toFixed(2)}e${e}`;
};

export const toks = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + "B"
  : n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
  : n >= 1e3 ? Math.round(n / 1e3) + "K"
  : String(Math.round(n));

/**
 * What a thousand lines cost.
 *
 * Cost over lines is a tiny number nobody can read, so it is scaled to a
 * thousand — the unit a day of agent work actually lands in. Null when there
 * are no lines, because dividing by nothing is not an efficiency.
 */
export const PER_LINES = 1000;

export function costPerKiloLine(cost: number, linesAdded: number): number | null {
  return linesAdded > 0 ? (cost / linesAdded) * PER_LINES : null;
}

/** A quiet stretch can run to days, and "126.4h" reads as a broken number. */
export const dur = (s: number) =>
  s >= 86_400 ? (s / 86_400).toFixed(1) + "d"
  : s >= 3_600 ? (s / 3_600).toFixed(1) + "h"
  : Math.round(s / 60) + "m";
