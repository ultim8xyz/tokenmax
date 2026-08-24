import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { ownerLogin, signupOpen } from "@/lib/auth";
import { normalizeGithubLogin } from "@/lib/github";
import { admit } from "@/lib/admission";

const MAX_USERNAME_ATTEMPTS = 20;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base.length >= 2 ? base : `builder-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveRole(githubLogin: string | null): Promise<"owner" | "member" | null> {
  if (!githubLogin) return null;
  const service = getServiceClient();
  const open = signupOpen();

  const { count } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");

  // Only consulted when the door is shut, so the open path costs one query.
  let invited = false;
  if (!open) {
    const { data } = await service
      .from("invites")
      .select("github_login")
      .eq("github_login", githubLogin)
      .maybeSingle();
    invited = Boolean(data);
  }

  return admit({
    githubLogin,
    open,
    ownerLogin: ownerLogin(),
    ownerTaken: (count ?? 0) > 0,
    invited,
  });
}

async function createProfile(
  userId: string,
  githubLogin: string,
  role: "owner" | "member",
): Promise<void> {
  const service = getServiceClient();
  const preferred = slugify(githubLogin);

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const username = attempt === 0 ? preferred : `${preferred}-${attempt}`;
    const { error } = await service
      .from("profiles")
      .insert({ id: userId, username, github_login: githubLogin, role });
    if (!error) return;
    // 23505 is a unique violation; only the username can realistically collide.
    if (error.code !== "23505") {
      throw new CallbackError("profile-insert", `${error.code ?? "?"}: ${error.message}`);
    }
  }
  throw new CallbackError("username-taken", "Could not allocate a username");
}

class CallbackError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  try {
    return await handle(request, url, site);
  } catch (err) {
    // A 500 on the sign-in path tells the user nothing and hides the cause, so
    // every failure leaves by the same door with a code attached.
    const code = err instanceof CallbackError ? err.code : "unexpected";
    console.error(`callback failed [${code}]`, err);
    return NextResponse.redirect(`${site}/login?error=${code}`);
  }
}

async function handle(request: Request, url: URL, site: string) {
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) return NextResponse.redirect(`${site}/login`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${site}/login?error=exchange`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${site}/login?error=session`);

  const meta = user.user_metadata as {
    user_name?: string;
    preferred_username?: string;
    name?: string;
    avatar_url?: string;
  };
  const githubLogin = normalizeGithubLogin(meta.user_name ?? meta.preferred_username);

  const service = getServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    // With signup open there is nothing for an owner to gate, so a missing
    // owner login is no longer fatal.
    if (!signupOpen() && !ownerLogin()) {
      throw new CallbackError("no-owner-configured", "TOKENMAX_OWNER_GITHUB_LOGIN is not set");
    }
    const role = await resolveRole(githubLogin);
    if (!role || !githubLogin) {
      // Drop the session so a stranger is not left holding a usable cookie.
      await supabase.auth.signOut();
      return NextResponse.redirect(`${site}/login?denied=1`);
    }
    await createProfile(user.id, githubLogin, role);
    await service.from("invites").delete().eq("github_login", githubLogin);
  }

  // display_name is the member's own alias, so it is never overwritten here.
  // Only the things GitHub owns get refreshed on each sign-in.
  await service
    .from("profiles")
    .update({
      avatar_url: meta.avatar_url ?? null,
      ...(githubLogin ? { github_login: githubLogin } : {}),
    })
    .eq("id", user.id);

  // Same-origin paths only, so ?next= cannot be used as an open redirect.
  return NextResponse.redirect(`${site}${next.startsWith("/") ? next : "/"}`);
}
