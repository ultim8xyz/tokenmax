export const MAX_DISPLAY_NAME = 32;

/**
 * An alias, or null to fall back to the username.
 *
 * Blank and whitespace-only both mean "use my username", so they normalise to
 * null rather than to an empty string that would render as a nameless row.
 * Returns undefined when the input is not a nameable value at all.
 */
export function normalizeDisplayName(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, MAX_DISPLAY_NAME) : null;
}
