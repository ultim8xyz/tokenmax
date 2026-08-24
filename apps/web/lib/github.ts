/** GitHub's own rule: alphanumerics and single inner hyphens, 1-39 chars. */
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/;

/** Returns the canonical lowercase login, or null if it is not a GitHub
 *  username. Everything that decides membership goes through here. */
export function normalizeGithubLogin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const login = value.trim().toLowerCase().replace(/^@/, "");
  return LOGIN_RE.test(login) ? login : null;
}
