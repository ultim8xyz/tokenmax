import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code.trim().toUpperCase();
  } catch {
    // Handled by the empty check below.
  }
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const service = getServiceClient();
  const { data, error } = await service
    .from("cli_auth_codes")
    .update({ status: "completed", user_id: user.id })
    .eq("code", code)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("code")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "That code is invalid or expired" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
