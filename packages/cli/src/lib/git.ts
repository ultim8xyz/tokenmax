import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { localDate, type Turn } from "./sessions.js";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 16 * 1024 * 1024;
/* What a Claude co-author trailer looks like once git has stripped the key.
 * `valueonly` yields "Claude Opus 5 <noreply@anthropic.com>", so matching the
 * key here would match nothing — which is exactly what it did. */
const TRAILER = "@anthropic.com";
/** Delimiters that cannot occur in an ISO date or a trailer value. */
const HEAD = "@@C@@";
const SEP = "@@T@@";

export interface DayLines {
  date: string;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: MAX_BUFFER,
    encoding: "utf-8",
  });
  return stdout;
}

/** The repository a path sits in, or null when it is not in one. */
export async function repoRoot(path: string): Promise<string | null> {
  try {
    return (await git(path, ["rev-parse", "--show-toplevel"])).trim() || null;
  } catch {
    return null;
  }
}

/** This machine's git identity. Commits by anyone else are somebody else's. */
export async function authorEmail(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", "user.email"], {
      encoding: "utf-8",
    });
    return stdout.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Reads insertions and deletions from agent-assisted commits.
 *
 * Two filters, both needed. The trailer is what makes a commit agent-assisted
 * rather than hand-written. The author is what keeps a collaborator's
 * agent-assisted commits — which carry the same trailer — out of your numbers,
 * which matters as soon as two people share a machine or a repo.
 */
export function parseLog(stdout: string): Map<string, DayLines> {
  const byDate = new Map<string, DayLines>();
  let current: DayLines | null = null;

  for (const line of stdout.split("\n")) {
    if (line.startsWith(HEAD)) {
      const [iso, trailers] = line.slice(HEAD.length).split(SEP);
      current = null;
      if (!iso || !trailers?.toLowerCase().includes(TRAILER)) continue;

      const at = Date.parse(iso);
      if (Number.isNaN(at)) continue;
      const date = localDate(at);
      current = byDate.get(date) ?? { date, linesAdded: 0, linesRemoved: 0, commits: 0 };
      current.commits += 1;
      byDate.set(date, current);
      continue;
    }

    if (!current || !line) continue;
    const [added, removed] = line.split("\t");
    // A binary file reports "-", which is not a line count.
    if (added === "-" || removed === "-") continue;
    const a = Number(added);
    const r = Number(removed);
    if (Number.isFinite(a)) current.linesAdded += a;
    if (Number.isFinite(r)) current.linesRemoved += r;
  }

  return byDate;
}

/** Every repository the agent has worked in, derived from the transcripts. */
export async function reposFrom(turns: Turn[]): Promise<string[]> {
  const roots = new Set<string>();
  const seen = new Set<string>();
  for (const turn of turns) {
    if (seen.has(turn.project)) continue;
    seen.add(turn.project);
    const root = await repoRoot(turn.project);
    if (root) roots.add(root);
  }
  return [...roots].sort();
}

/**
 * Line counts for the given identities.
 *
 * Plural because one person is routinely several git identities — a work
 * address, a personal one, and whatever an unconfigured machine invented. One
 * address would silently drop most of the history.
 */
export async function collectLines(
  repos: string[],
  since: string,
  until: string,
  authors: string[],
): Promise<DayLines[]> {
  if (authors.length === 0) return [];

  const merged = new Map<string, DayLines>();
  for (const repo of repos) {
    let stdout: string;
    try {
      stdout = await git(repo, [
        "log",
        // git ORs repeated --author, so this is "any of mine".
        ...authors.map((a) => `--author=${a}`),
        `--since=${since}T00:00:00`,
        `--until=${until}T23:59:59`,
        "--no-merges",
        "--numstat",
        `--pretty=format:${HEAD}%aI${SEP}%(trailers:key=Co-authored-by,valueonly,separator=;)`,
      ]);
    } catch {
      continue;
    }

    for (const [date, day] of parseLog(stdout)) {
      const existing = merged.get(date);
      if (!existing) {
        merged.set(date, { ...day });
        continue;
      }
      existing.linesAdded += day.linesAdded;
      existing.linesRemoved += day.linesRemoved;
      existing.commits += day.commits;
    }
  }

  // git --since/--until filter on commit date; days are bucketed by author
  // date, so a rebased commit can land just outside the window.
  return [...merged.values()]
    .filter((d) => d.date >= since && d.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
}
