import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Pinned exactly in package.json; bump deliberately, never by range. */
const EXPECTED_VERSION = "20.0.20";
const MAX_BUFFER = 20 * 1024 * 1024;

export interface ModelBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUSD: number;
}

export interface DailyEntry {
  date: string;
  agents: string[];
  models: string[];
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  modelBreakdown: ModelBreakdown[];
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveCli(): { entry: string; version: string } {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("ccusage/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { version?: string };
  const version = typeof manifest.version === "string" ? manifest.version : "unknown";
  if (version !== EXPECTED_VERSION) {
    throw new Error(
      `ccusage ${version} is installed but tokenmax pins ${EXPECTED_VERSION}. ` +
        `Reinstall dependencies rather than running an unaudited version.`,
    );
  }
  return { entry: require.resolve("ccusage/src/cli.js"), version };
}

function parseBreakdown(raw: unknown): ModelBreakdown[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((row) => ({
    model: typeof row.modelName === "string" ? row.modelName : "unknown",
    inputTokens: num(row.inputTokens),
    outputTokens: num(row.outputTokens),
    cacheCreationTokens: num(row.cacheCreationTokens),
    cacheReadTokens: num(row.cacheReadTokens),
    costUSD: num(row.cost ?? row.costUSD),
  }));
}

export function parseDaily(raw: string): DailyEntry[] {
  const parsed: unknown = JSON.parse(raw);
  const rows = isRecord(parsed) && Array.isArray(parsed.daily) ? parsed.daily : [];

  const byDate = new Map<string, DailyEntry>();
  for (const row of rows) {
    if (!isRecord(row)) continue;
    // ccusage emits one "all" roll-up row per day alongside per-agent rows.
    // Taking only the roll-up avoids double counting.
    if (row.agent !== "all") continue;

    const date = typeof row.period === "string" ? row.period : undefined;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const inputTokens = num(row.inputTokens);
    const outputTokens = num(row.outputTokens);
    const cacheCreationTokens = num(row.cacheCreationTokens);
    const cacheReadTokens = num(row.cacheReadTokens);
    const totalTokens = num(row.totalTokens);
    const metadata = isRecord(row.metadata) ? row.metadata : {};

    byDate.set(date, {
      date,
      agents: strings(metadata.agents),
      models: strings(row.modelsUsed),
      inputTokens,
      outputTokens,
      reasoningOutputTokens: Math.max(
        totalTokens - inputTokens - outputTokens - cacheCreationTokens - cacheReadTokens,
        0,
      ),
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD: num(row.totalCost ?? row.costUSD),
      modelBreakdown: parseBreakdown(row.modelBreakdowns),
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function collectDaily(since?: string, until?: string): Promise<DailyEntry[]> {
  const { entry } = resolveCli();
  const args = [entry, "daily", "--json"];
  if (since) args.push("--since", since.replace(/-/g, ""));
  if (until) args.push("--until", until.replace(/-/g, ""));

  const { stdout } = await execFileAsync(process.execPath, args, {
    maxBuffer: MAX_BUFFER,
    encoding: "utf-8",
  });
  return parseDaily(stdout);
}
