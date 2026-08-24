import { NextResponse } from "next/server";
import { createCliToken, hashDeviceSecret } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

/** Exchanges an enrolment code for a CLI token. One redemption, then it is spent. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`cli-redeem:${ip}`, 20)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code.trim();
  } catch {
    // Handled by the empty check below.
  }
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const service = getServiceClient();
  const { data: row } = await service
    .from("cli_auth_codes")
    .select("id, status, user_id, expires_at")
    .eq("code", code)
    .eq("poll_secret_hash", hashDeviceSecret(code))
    .maybeSingle();

  if (!row || row.status !== "completed" || !row.user_id) {
    return NextResponse.json({ error: "That setup code is invalid or already used" }, { status: 400 });
  }
  if (new Date(row.expires_at) < new Date()) {
    await service.from("cli_auth_codes").update({ status: "expired" }).eq("id", row.id);
    return NextResponse.json({ error: "That setup code has expired" }, { status: 400 });
  }

  // Guarded on redeemed_at, so a replayed request is a no-op rather than a
  // second token.
  const { data: redeemed } = await service
    .from("cli_auth_codes")
    .update({ status: "used", redeemed_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "completed")
    .is("redeemed_at", null)
    .select("user_id")
    .single();

  if (!redeemed?.user_id) {
    return NextResponse.json({ error: "That setup code is already used" }, { status: 400 });
  }

  const { data: profile } = await service
    .from("profiles")
    .select("username")
    .eq("id", redeemed.user_id)
    .maybeSingle();

  return NextResponse.json({
    token: createCliToken(redeemed.user_id, profile?.username ?? null),
    username: profile?.username ?? null,
  });
}
