import { unstable_cache } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";
import { isoDate, shiftDays } from "@/lib/streak";
import { hueFor, type DayRow, type MemberRow } from "@/lib/console/board";

const DAILY_COLUMNS =
  "user_id, usage_date, cost_usd, total_tokens, sessions, interactive_sessions, projects, max_concurrent_sessions, device_count, max_gap_seconds, lines_added, lines_removed, commits";

/**
 * Every listed, onboarded member with their last 30 days.
 *
 * One query for the members and one for the days, then joined here. The
 * audience is a handful of friends, so this is cheaper than a view that would
 * have to carry a sparkline.
 */
export const BOARD_TAG = "board";

/**
 * The board is the same for everyone, so it is fetched once and shared.
 *
 * Sixty seconds is the ceiling on staleness; a push clears the tag, so a sync
 * shows up immediately rather than a minute later. Per-member reads stay
 * uncached — those differ by viewer.
 */
export const loadBoard = unstable_cache(loadBoardUncached, ["board"], {
  revalidate: 60,
  tags: [BOARD_TAG],
});

async function loadBoardUncached(today = new Date()): Promise<MemberRow[]> {
  const service = getServiceClient();
  const since = isoDate(shiftDays(today, -29));

  const { data: profiles } = await service
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("is_listed", true)
    .not("onboarded_at", "is", null);

  if (!profiles?.length) return [];

  const { data: rows } = await service
    .from("daily_usage")
    .select(DAILY_COLUMNS)
    .gte("usage_date", since)
    .in("user_id", profiles.map((p) => p.id as string));

  const byUser = new Map<string, DayRow[]>();
  for (const row of rows ?? []) {
    const id = row.user_id as string;
    const list = byUser.get(id);
    if (list) list.push(row as unknown as DayRow);
    else byUser.set(id, [row as unknown as DayRow]);
  }

  return profiles
    .map((p) => ({
      username: p.username as string,
      displayName: (p.display_name as string | null) ?? null,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      hue: hueFor(p.username as string),
      days: (byUser.get(p.id as string) ?? []).sort((a, b) =>
        a.usage_date.localeCompare(b.usage_date),
      ),
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

/** One member, whether or not they are listed. */
export async function loadMember(username: string, today = new Date()) {
  const service = getServiceClient();
  const since = isoDate(shiftDays(today, -29));

  const { data: profile } = await service
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_listed, github_login")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return null;

  const { data: rows } = await service
    .from("daily_usage")
    .select(DAILY_COLUMNS)
    .eq("user_id", profile.id as string)
    .gte("usage_date", since)
    .order("usage_date");

  // Per-model tokens live only on the device rows, so the mix pane needs its
  // own read; the daily rollup keeps names but not their weights.
  const { data: deviceRows } = await service
    .from("device_usage")
    .select("model_breakdown")
    .eq("user_id", profile.id as string)
    .gte("usage_date", since);

  const mix = new Map<string, number>();
  for (const row of deviceRows ?? []) {
    const breakdown = row.model_breakdown;
    if (!Array.isArray(breakdown)) continue;
    for (const entry of breakdown) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const model = typeof e.model === "string" ? e.model : "unknown";
      const tokens =
        Number(e.inputTokens ?? 0) + Number(e.outputTokens ?? 0) +
        Number(e.cacheCreationTokens ?? 0) + Number(e.cacheReadTokens ?? 0);
      mix.set(model, (mix.get(model) ?? 0) + (Number.isFinite(tokens) ? tokens : 0));
    }
  }

  const { data: devices } = await service
    .from("devices")
    .select("name, last_seen_at")
    .eq("user_id", profile.id as string)
    .order("last_seen_at", { ascending: false });

  return {
    id: profile.id as string,
    username: profile.username as string,
    displayName: (profile.display_name as string | null) ?? null,
    avatarUrl: (profile.avatar_url as string | null) ?? null,
    githubLogin: (profile.github_login as string | null) ?? null,
    isListed: Boolean(profile.is_listed),
    hue: hueFor(profile.username as string),
    days: (rows ?? []) as unknown as DayRow[],
    mix: [...mix.entries()].sort((a, b) => b[1] - a[1]),
    devices: (devices ?? []).map((d) => ({
      name: (d.name as string) ?? "unknown",
      lastSeenAt: d.last_seen_at as string,
    })),
  };
}
