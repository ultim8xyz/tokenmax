import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getMember } from "@/lib/auth";
import { hashDeviceSecret } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

const TTL_MINUTES = 30;

/**
 * Mints an enrolment code for the signed-in member.
 *
 * The code goes straight into the command the onboarding page displays, so
 * running it needs no second browser trip — the browser has already proved who
 * you are. That makes the code a bearer credential, hence 32 random bytes
 * rather than the eight readable characters of the type-it-in flow.
 */
export async function POST() {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

  const { error } = await getServiceClient().from("cli_auth_codes").insert({
    code,
    poll_secret_hash: hashDeviceSecret(code),
    status: "completed",
    user_id: member.id,
    device_name: "enrolment",
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: "Could not start enrolment" }, { status: 500 });
  return NextResponse.json({ code, expires_at: expiresAt });
}
