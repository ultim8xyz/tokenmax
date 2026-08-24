export type Role = "owner" | "member";

export interface AdmissionInput {
  githubLogin: string | null;
  /** True when signing in with GitHub is enough on its own. */
  open: boolean;
  /** The configured owner login, lowercased, or null. */
  ownerLogin: string | null;
  /** Whether an owner already exists. */
  ownerTaken: boolean;
  /** Whether this login sits on the invite list. Only consulted when closed. */
  invited: boolean;
}

/**
 * Who gets a profile, and as what.
 *
 * Pulled out of the callback so the one branch that decides who may enter is
 * testable without an OAuth round trip.
 */
export function admit(input: AdmissionInput): Role | null {
  if (!input.githubLogin) return null;
  if (input.ownerLogin && input.githubLogin === input.ownerLogin && !input.ownerTaken) {
    return "owner";
  }
  if (input.open) return "member";
  return input.invited ? "member" : null;
}
