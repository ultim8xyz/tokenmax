import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { isoDate, shiftDays } from "@/lib/streak";

/** Polled by the onboarding page while it waits for the CLI to arrive. */
export async function GET() {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const service = getServiceClient();
  const weekStart = isoDate(shiftDays(new Date(), -6));

  const [{ data: devices }, { data: week }] = await Promise.all([
    service
      .from("devices")
      .select("name, last_seen_at")
      .eq("user_id", member.id)
      .order("last_seen_at", { ascending: false }),
    service
      .from("daily_usage")
      .select("cost_usd, total_tokens")
      .eq("user_id", member.id)
      .gte("usage_date", weekStart),
  ]);

  return NextResponse.json({
    onboarded: Boolean(member.onboardedAt),
    devices: (devices ?? []).map((d) => ({
      name: (d.name as string) ?? "unknown",
      last_seen_at: d.last_seen_at as string,
    })),
    week: {
      cost_usd: (week ?? []).reduce((a, r) => a + Number(r.cost_usd), 0),
      total_tokens: (week ?? []).reduce((a, r) => a + Number(r.total_tokens), 0),
    },
  });
}
