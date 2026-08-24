import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { isoDate, shiftDays, streakFrom } from "@/lib/streak";
import { WINDOWS, type WindowKey } from "@/lib/windows";
import { maxDowntimeSeconds, type ActivityDay } from "@/lib/downtime";

const STREAK_LOOKBACK_DAYS = 120;

const DAILY_COLUMNS =
  "usage_date, cost_usd, total_tokens, sessions, interactive_sessions, projects, max_concurrent_sessions, first_activity_at, last_activity_at, max_gap_seconds";

interface DailyRow {
  usage_date: string;
  cost_usd: number;
  total_tokens: number;
  sessions: number;
  interactive_sessions: number;
  projects: number;
  max_concurrent_sessions: number;
  first_activity_at: string | null;
  last_activity_at: string | null;
  max_gap_seconds: number;
}

interface WindowTotals {
  cost_usd: number;
  total_tokens: number;
  rank: number | null;
  sessions: number;
  interactive_sessions: number;
  projects: number;
  max_concurrent_sessions: number;
}

export async function GET(request: Request) {
  const auth = authenticate(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = getServiceClient();
  const today = new Date();
  // Lower bound only: a device ahead of UTC may report tomorrow's date.
  const lowerBound = (days: number) => isoDate(shiftDays(today, -(days - 1)));

  const [{ data: rollups }, { data: devices }, { data: board }, { data: profile }] =
    await Promise.all([
      service
        .from("daily_usage")
        .select(DAILY_COLUMNS)
        .eq("user_id", auth.userId)
        .gte("usage_date", isoDate(shiftDays(today, -STREAK_LOOKBACK_DAYS))),
      service.from("devices").select("device_id, name, last_seen_at").eq("user_id", auth.userId),
      service
        .from("leaderboard")
        .select("username, cost_1d, cost_7d, cost_30d"),
      service.from("profiles").select("username").eq("id", auth.userId).maybeSingle(),
    ]);

  const rows = (rollups ?? []) as unknown as DailyRow[];
  const username = profile?.username ?? auth.username;

  function totalsFor(key: WindowKey, days: number): WindowTotals {
    const since = lowerBound(days);
    const mine = rows.filter((r) => r.usage_date >= since);
    const ranked = [...(board ?? [])]
      .map((r) => ({ username: r.username as string, cost: Number(r[`cost_${key}`]) }))
      .filter((r) => r.cost > 0)
      .sort((a, b) => b.cost - a.cost);
    const index = ranked.findIndex((r) => r.username === username);

    const sum = (field: keyof DailyRow) =>
      mine.reduce((total, r) => total + Number(r[field] ?? 0), 0);
    const peak = (field: keyof DailyRow) =>
      mine.reduce((best, r) => Math.max(best, Number(r[field] ?? 0)), 0);

    return {
      cost_usd: sum("cost_usd"),
      total_tokens: sum("total_tokens"),
      rank: index >= 0 ? index + 1 : null,
      sessions: sum("sessions"),
      interactive_sessions: sum("interactive_sessions"),
      // Peaks and project counts are day-level maxima; summing them would be
      // meaningless.
      projects: peak("projects"),
      max_concurrent_sessions: peak("max_concurrent_sessions"),
    };
  }

  const windows = Object.fromEntries(
    WINDOWS.map((w) => [w.key, totalsFor(w.key, w.days)]),
  ) as Record<WindowKey, WindowTotals>;

  const { data: deviceUsage } = await service
    .from("device_usage")
    .select("device_id, cost_usd")
    .eq("user_id", auth.userId)
    .gte("usage_date", lowerBound(30));

  const costByDevice = new Map<string, number>();
  for (const row of deviceUsage ?? []) {
    const id = row.device_id as string;
    costByDevice.set(id, (costByDevice.get(id) ?? 0) + Number(row.cost_usd));
  }

  const response = NextResponse.json({
    username,
    streak_days: streakFrom(new Set(rows.map((r) => r.usage_date))),
    max_downtime_seconds: maxDowntimeSeconds(rows satisfies ActivityDay[]),
    windows,
    devices: (devices ?? []).map((d) => ({
      device_name: (d.name as string) ?? "unknown",
      last_seen_at: d.last_seen_at as string,
      cost_usd_30d: costByDevice.get(d.device_id as string) ?? 0,
    })),
  });

  if (auth.refreshedToken) response.headers.set("x-tokenmax-refreshed-token", auth.refreshedToken);
  return response;
}
