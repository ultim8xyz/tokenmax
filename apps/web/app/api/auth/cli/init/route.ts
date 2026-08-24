import { NextResponse } from "next/server";
import { createAuthCode, createDeviceSecret, hashDeviceSecret } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

const CODE_TTL_MINUTES = 10;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`cli-init:${ip}`, 10)) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
  }

  let deviceName: string | null = null;
  try {
    const body = (await request.json()) as { device_name?: unknown };
    if (typeof body.device_name === "string") deviceName = body.device_name.slice(0, 64);
  } catch {
    // device_name is optional.
  }

  const code = createAuthCode();
  const pollSecret = createDeviceSecret();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error } = await getServiceClient().from("cli_auth_codes").insert({
    code,
    poll_secret_hash: hashDeviceSecret(pollSecret),
    device_name: deviceName,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: "Could not start login" }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return NextResponse.json({
    code,
    poll_secret: pollSecret,
    verify_url: `${site}/cli?code=${encodeURIComponent(code)}`,
  });
}
