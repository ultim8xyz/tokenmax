import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";

/** Polled by the onboarding page while it waits for the CLI to arrive. */
export async function GET() {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: devices } = await getServiceClient()
    .from("devices")
    .select("name, last_seen_at")
    .eq("user_id", member.id)
    .order("last_seen_at", { ascending: false });

  return NextResponse.json({
    onboarded: Boolean(member.onboardedAt),
    devices: (devices ?? []).map((d) => ({
      name: (d.name as string) ?? "unknown",
      last_seen_at: d.last_seen_at as string,
    })),
  });
}
