import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

/** A session counts as live until this long after its most recent turn. */
export const DEFAULT_TTL_SECONDS = 15 * 60;

const PROJECTS_DIR = join(homedir(), ".claude", "projects");
const TURN_TYPES = new Set(["user", "assistant"]);

export interface Turn {
  session: string;
  project: string;
  at: number;
  /** `cli` is a terminal you opened. `sdk-*` is a session some agent spawned:
   *  subagents, workflows, `claude -p`. Both are sessions; only one is you. */
  interactive: boolean;
}

export interface SessionStats {
  date: string;
  sessions: number;
  interactiveSessions: number;
  projects: number;
  maxConcurrentSessions: number;
  firstActivityAt: string;
  lastActivityAt: string;
  /** Largest quiet stretch between two turns inside this day. */
  maxGapSeconds: number;
}

/** ccusage buckets by the machine's local day; these must agree or the two
 *  halves of a row would describe different windows. */
export function localDate(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Peak overlap, where a session occupies `[turn, turn + ttl]` for each of its
 * turns. Consecutive turns inside the TTL merge into one span, so a long
 * session counts once rather than once per message.
 */
export function maxConcurrent(turns: Turn[], ttlSeconds: number): number {
  const ttl = ttlSeconds * 1000;
  const spans: [number, number][] = [];

  const bySession = new Map<string, number[]>();
  for (const turn of turns) {
    const list = bySession.get(turn.session);
    if (list) list.push(turn.at);
    else bySession.set(turn.session, [turn.at]);
  }

  for (const times of bySession.values()) {
    times.sort((a, b) => a - b);
    let start = times[0]!;
    let end = start + ttl;
    for (const at of times.slice(1)) {
      if (at <= end) {
        end = at + ttl;
        continue;
      }
      spans.push([start, end]);
      start = at;
      end = at + ttl;
    }
    spans.push([start, end]);
  }

  const edges = spans
    .flatMap(([start, end]) => [
      { at: start, delta: 1 },
      { at: end, delta: -1 },
    ])
    // Close before open at the same instant: a session that ends exactly as
    // another starts was never concurrent with it.
    .sort((a, b) => a.at - b.at || a.delta - b.delta);

  let live = 0;
  let peak = 0;
  for (const edge of edges) {
    live += edge.delta;
    if (live > peak) peak = live;
  }
  return peak;
}

export function summarize(turns: Turn[], ttlSeconds = DEFAULT_TTL_SECONDS): SessionStats[] {
  const byDate = new Map<string, Turn[]>();
  for (const turn of turns) {
    const date = localDate(turn.at);
    const list = byDate.get(date);
    if (list) list.push(turn);
    else byDate.set(date, [turn]);
  }

  const out: SessionStats[] = [];
  for (const [date, dayTurns] of byDate) {
    const times = dayTurns.map((t) => t.at).sort((a, b) => a - b);

    let maxGap = 0;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i]! - times[i - 1]!;
      if (gap > maxGap) maxGap = gap;
    }

    out.push({
      date,
      sessions: new Set(dayTurns.map((t) => t.session)).size,
      interactiveSessions: new Set(
        dayTurns.filter((t) => t.interactive).map((t) => t.session),
      ).size,
      projects: new Set(dayTurns.map((t) => t.project)).size,
      maxConcurrentSessions: maxConcurrent(dayTurns, ttlSeconds),
      firstActivityAt: new Date(times[0]!).toISOString(),
      lastActivityAt: new Date(times[times.length - 1]!).toISOString(),
      maxGapSeconds: Math.round(maxGap / 1000),
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

async function readTurns(path: string, project: string, from: number, to: number): Promise<Turn[]> {
  const turns: Turn[] = [];
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!TURN_TYPES.has(String(row.type))) continue;

    const timestamp = row.timestamp;
    const session = row.sessionId;
    if (typeof timestamp !== "string" || typeof session !== "string") continue;

    const at = Date.parse(timestamp);
    if (Number.isNaN(at) || at < from || at > to) continue;

    // cwd is the repo the turn ran in; only its identity is ever used, and the
    // count is all that leaves this machine.
    turns.push({
      session,
      project: typeof row.cwd === "string" ? row.cwd : project,
      at,
      interactive: row.entrypoint === "cli",
    });
  }

  return turns;
}

/** Reads local transcripts between two YYYY-MM-DD dates. Nothing but the
 *  derived counts ever leaves this function. */
export async function collectSessions(
  since: string,
  until: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<SessionStats[]> {
  const from = new Date(`${since}T00:00:00`).getTime();
  const to = new Date(`${until}T23:59:59.999`).getTime();

  let projectDirs: string[];
  try {
    projectDirs = (await readdir(PROJECTS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const turns: Turn[] = [];
  for (const project of projectDirs) {
    const dir = join(PROJECTS_DIR, project);
    let files: string[];
    try {
      files = (await readdir(dir)).filter((name) => name.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const path = join(dir, file);
      try {
        // A transcript last written before the window cannot contain a turn
        // inside it, so most files are skipped without being opened.
        if ((await stat(path)).mtimeMs < from) continue;
        turns.push(...(await readTurns(path, project, from, to)));
      } catch {
        continue;
      }
    }
  }

  return summarize(turns, ttlSeconds);
}
