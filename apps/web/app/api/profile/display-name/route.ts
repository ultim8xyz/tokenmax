import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { normalizeDisplayName } from "@/lib/display-name";

export async function POST(request: Request) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { display_name?: unknown } | null;
  const value = normalizeDisplayName(body?.display_name);
  if (value === undefined) {
    return NextResponse.json({ error: "display_name must be a string" }, { status: 400 });
  }

  const { error } = await getServiceClient()
    .from("profiles")
    .update({ display_name: value })
    .eq("id", member.id);

  if (error) return NextResponse.json({ error: "Could not update" }, { status: 500 });
  return NextResponse.json({ ok: true, display_name: value, username: member.username });
}
