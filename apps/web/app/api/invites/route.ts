import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { normalizeGithubLogin } from "@/lib/github";

async function requireOwnerApi() {
  const member = await getMember();
  if (!member) return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  if (member.role !== "owner") {
    return { error: NextResponse.json({ error: "Owner only" }, { status: 403 }) };
  }
  return { member };
}

function readLogin(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  return normalizeGithubLogin((body as { github_login?: unknown }).github_login);
}

export async function POST(request: Request) {
  const { member, error } = await requireOwnerApi();
  if (error) return error;

  const login = readLogin(await request.json().catch(() => null));
  if (!login) return NextResponse.json({ error: "Not a GitHub username" }, { status: 400 });

  const { error: insertError } = await getServiceClient()
    .from("invites")
    .upsert({ github_login: login, invited_by: member.id }, { onConflict: "github_login" });

  if (insertError) return NextResponse.json({ error: "Could not invite" }, { status: 500 });
  return NextResponse.json({ ok: true, github_login: login });
}

export async function DELETE(request: Request) {
  const { error } = await requireOwnerApi();
  if (error) return error;

  const login = readLogin(await request.json().catch(() => null));
  if (!login) return NextResponse.json({ error: "Not a GitHub username" }, { status: 400 });

  await getServiceClient().from("invites").delete().eq("github_login", login);
  return NextResponse.json({ ok: true });
}
