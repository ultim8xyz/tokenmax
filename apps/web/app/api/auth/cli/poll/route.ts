import { NextResponse } from "next/server";
import { createCliToken, hashDeviceSecret } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  let code = "";
  let pollSecret = "";
  try {
    const body = (await request.json()) as { code?: unknown; poll_secret?: unknown };
    if (typeof body.code === "string") code = body.code.trim();
    if (typeof body.poll_secret === "string") pollSecret = body.poll_secret.trim();
  } catch {
    // Handled by the empty checks below.
  }
  if (!code || !pollSecret) {
    return NextResponse.json({ error: "Missing code or poll_secret" }, { status: 400 });
  }

  const service = getServiceClient();
  // Matching on the secret hash as well as the code means knowing a code that
  // was read aloud is not enough to steal the token it will produce.
  const { data: authCode } = await service
    .from("cli_auth_codes")
    .select("id, status, user_id, expires_at")
    .eq("code", code)
    .eq("poll_secret_hash", hashDeviceSecret(pollSecret))
    .maybeSingle();

  if (!authCode) return NextResponse.json({ status: "expired" });
  if (new Date(authCode.expires_at) < new Date()) {
    await service.from("cli_auth_codes").update({ status: "expired" }).eq("id", authCode.id);
    return NextResponse.json({ status: "expired" });
  }
  if (authCode.status === "pending") return NextResponse.json({ status: "pending" });
  if (authCode.status !== "completed" || !authCode.user_id) {
    return NextResponse.json({ status: "expired" });
  }

  // Redeem exactly once: the redeemed_at guard makes a replayed poll a no-op.
  const { data: redeemed } = await service
    .from("cli_auth_codes")
    .update({ status: "used", redeemed_at: new Date().toISOString() })
    .eq("id", authCode.id)
    .eq("status", "completed")
    .is("redeemed_at", null)
    .select("user_id")
    .single();

  if (!redeemed?.user_id) return NextResponse.json({ status: "expired" });

  const { data: profile } = await service
    .from("profiles")
    .select("username")
    .eq("id", redeemed.user_id)
    .maybeSingle();

  return NextResponse.json({
    status: "used",
    token: createCliToken(redeemed.user_id, profile?.username ?? null),
    username: profile?.username ?? null,
  });
}
