import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

export interface Member {
  id: string;
  username: string;
  githubLogin: string | null;
  /** Optional alias. Null means show the username. */
  displayName: string | null;
  avatarUrl: string | null;
  role: "owner" | "member";
  isListed: boolean;
  /** Set by the first successful push. Null means the CLI has never arrived. */
  onboardedAt: string | null;
}


/**
 * Whether signing in with GitHub is enough to become a member.
 *
 * Open by default. Set TOKENMAX_OPEN_SIGNUP=0 to go back to the invite list,
 * which still exists underneath — closing the door is a config change, not a
 * code change.
 */
export function signupOpen(): boolean {
  return process.env.TOKENMAX_OPEN_SIGNUP !== "0";
}

/** The GitHub login that becomes the owner on first sign-in. Set this before
 *  anyone signs in, or the instance has no way to hand out invites. */
export function ownerLogin(): string | null {
  const value = process.env.TOKENMAX_OWNER_GITHUB_LOGIN?.trim().toLowerCase();
  return value ? value : null;
}

export async function getMember(): Promise<Member | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await getServiceClient()
    .from("profiles")
    .select("id, username, github_login, display_name, avatar_url, role, is_listed, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    username: data.username as string,
    githubLogin: (data.github_login as string | null) ?? null,
    displayName: (data.display_name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    role: data.role as "owner" | "member",
    isListed: Boolean(data.is_listed),
    onboardedAt: (data.onboarded_at as string | null) ?? null,
  };
}

/** Every page except /login goes through this. Having an auth.users row is not
 *  membership; having a profile row is.
 *
 *  A member who has never synced is held at /onboarding: an account with no
 *  numbers behind it is not yet a participant. */
export async function requireMember(next = "/"): Promise<Member> {
  const member = await getMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!member.onboardedAt) redirect("/onboarding");
  return member;
}

/** For the onboarding page itself, which must not bounce to itself. */
export async function requireAnyMember(next = "/"): Promise<Member> {
  const member = await getMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(next)}`);
  return member;
}

export async function requireOwner(next = "/"): Promise<Member> {
  const member = await requireMember(next);
  if (member.role !== "owner") redirect("/");
  return member;
}
