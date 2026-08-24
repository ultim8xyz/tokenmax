import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { is_listed?: unknown } | null;
  if (typeof body?.is_listed !== "boolean") {
    return NextResponse.json({ error: "is_listed must be a boolean" }, { status: 400 });
  }

  const { error } = await getServiceClient()
    .from("profiles")
    .update({ is_listed: body.is_listed })
    .eq("id", member.id);

  if (error) return NextResponse.json({ error: "Could not update" }, { status: 500 });
  return NextResponse.json({ ok: true, is_listed: body.is_listed });
}
