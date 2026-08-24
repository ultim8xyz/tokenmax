import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authenticate } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { BOARD_TAG } from "@/lib/console/load";

const MAX_BACKFILL_DAYS = 30;
const MAX_ENTRIES = MAX_BACKFILL_DAYS + 2;
const MAX_BODY_BYTES = 256 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Entry {
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
  modelBreakdown: unknown;
  sessions: number;
  interactiveSessions: number;
  projects: number;
  maxConcurrentSessions: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  maxGapSeconds: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
}

const MAX_SESSIONS_PER_DAY = 5_000_000;

function counter(value: unknown): number {
  const n = nonNegative(value ?? 0);
  return n === null ? 0 : Math.min(Math.round(n), MAX_SESSIONS_PER_DAY);
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringArray(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, cap);
}

function withinWindow(date: string): boolean {
  const target = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(target)) return false;
  const ageDays = (Date.now() - target) / 86_400_000;
  // Allowing one day into the future covers a device running ahead of UTC.
  return ageDays >= -1 && ageDays <= MAX_BACKFILL_DAYS;
}

function parseEntry(raw: unknown): Entry | null {
  if (!isRecord(raw)) return null;
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !withinWindow(date)) return null;

  const numbers = {
    inputTokens: nonNegative(raw.inputTokens),
    outputTokens: nonNegative(raw.outputTokens),
    reasoningOutputTokens: nonNegative(raw.reasoningOutputTokens ?? 0),
    cacheCreationTokens: nonNegative(raw.cacheCreationTokens),
    cacheReadTokens: nonNegative(raw.cacheReadTokens),
    totalTokens: nonNegative(raw.totalTokens),
    costUSD: nonNegative(raw.costUSD),
  };
  if (Object.values(numbers).some((v) => v === null)) return null;

  return {
    date,
    agents: stringArray(raw.agents, 16),
    models: stringArray(raw.models, 32),
    modelBreakdown: Array.isArray(raw.modelBreakdown) ? raw.modelBreakdown.slice(0, 32) : [],
    sessions: counter(raw.sessions),
    interactiveSessions: counter(raw.interactiveSessions),
    projects: counter(raw.projects),
    maxConcurrentSessions: counter(raw.maxConcurrentSessions),
    firstActivityAt: timestamp(raw.firstActivityAt),
    lastActivityAt: timestamp(raw.lastActivityAt),
    maxGapSeconds: counter(raw.maxGapSeconds),
    linesAdded: counter(raw.linesAdded),
    linesRemoved: counter(raw.linesRemoved),
    commits: counter(raw.commits),
    ...(numbers as Record<keyof typeof numbers, number>),
  };
}

async function readBody(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = authenticate(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!rateLimit(`submit:${auth.userId}`, 30)) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
  }

  const body = await readBody(request);
  if (!isRecord(body)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  if (!UUID_RE.test(deviceId)) {
    return NextResponse.json({ error: "device_id must be a UUID" }, { status: 400 });
  }
  const deviceName =
    typeof body.device_name === "string" && body.device_name
      ? body.device_name.slice(0, 64)
      : "unknown";

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "No entries" }, { status: 400 });
  }
  if (body.entries.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `At most ${MAX_ENTRIES} entries` }, { status: 400 });
  }

  const entries = body.entries.map(parseEntry).filter((e): e is Entry => e !== null);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid entries in range" }, { status: 400 });
  }

  const service = getServiceClient();
  const now = new Date().toISOString();

  const { error: deviceError } = await service.from("devices").upsert(
    { user_id: auth.userId, device_id: deviceId, name: deviceName, last_seen_at: now },
    { onConflict: "user_id,device_id" },
  );
  if (deviceError) {
    return NextResponse.json({ error: "Could not record device" }, { status: 500 });
  }

  // Upsert on (user, date, device): this device replaces only its own row, so
  // a second machine's rows for the same day survive and the trigger sums them.
  const { error: usageError } = await service.from("device_usage").upsert(
    entries.map((entry) => ({
      user_id: auth.userId,
      usage_date: entry.date,
      device_id: deviceId,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      reasoning_output_tokens: entry.reasoningOutputTokens,
      cache_creation_tokens: entry.cacheCreationTokens,
      cache_read_tokens: entry.cacheReadTokens,
      total_tokens: entry.totalTokens,
      cost_usd: entry.costUSD,
      models: entry.models,
      agents: entry.agents,
      model_breakdown: entry.modelBreakdown,
      sessions: entry.sessions,
      interactive_sessions: entry.interactiveSessions,
      projects: entry.projects,
      max_concurrent_sessions: entry.maxConcurrentSessions,
      first_activity_at: entry.firstActivityAt,
      last_activity_at: entry.lastActivityAt,
      max_gap_seconds: entry.maxGapSeconds,
      lines_added: entry.linesAdded,
      lines_removed: entry.linesRemoved,
      commits: entry.commits,
      collector: "ccusage-20+transcripts",
      updated_at: now,
    })),
    { onConflict: "user_id,usage_date,device_id" },
  );
  if (usageError) {
    return NextResponse.json({ error: "Could not store usage" }, { status: 500 });
  }

  // The first push is what "onboarded" means: the CLI reached us with real
  // numbers. Only the first one writes, so the timestamp stays truthful.
  await service
    .from("profiles")
    .update({ onboarded_at: now })
    .eq("id", auth.userId)
    .is("onboarded_at", null);

  // A sync should be on the board by the time the pusher opens it, so the
  // shared cache is dropped rather than waited out.
  revalidateTag(BOARD_TAG);

  const dates = entries.map((e) => e.date);
  const [{ data: rollups }, { data: devices }] = await Promise.all([
    service
      .from("daily_usage")
      .select("cost_usd, total_tokens")
      .eq("user_id", auth.userId)
      .in("usage_date", dates),
    service
      .from("device_usage")
      .select("device_id, cost_usd")
      .eq("user_id", auth.userId)
      .in("usage_date", dates),
  ]);

  const { data: deviceNames } = await service
    .from("devices")
    .select("device_id, name")
    .eq("user_id", auth.userId);

  const nameFor = new Map((deviceNames ?? []).map((d) => [d.device_id as string, d.name as string]));
  const perDevice = new Map<string, number>();
  for (const row of devices ?? []) {
    const id = row.device_id as string;
    perDevice.set(id, (perDevice.get(id) ?? 0) + Number(row.cost_usd));
  }

  const response = NextResponse.json({
    accepted: entries.length,
    totals: {
      cost_usd: (rollups ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0),
      total_tokens: (rollups ?? []).reduce((sum, r) => sum + Number(r.total_tokens), 0),
    },
    devices: [...perDevice.entries()]
      .map(([id, cost]) => ({ device_name: nameFor.get(id) ?? "unknown", cost_usd: cost }))
      .sort((a, b) => b.cost_usd - a.cost_usd),
  });

  if (auth.refreshedToken) response.headers.set("x-tokenmax-refreshed-token", auth.refreshedToken);
  return response;
}
