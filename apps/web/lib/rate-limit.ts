const WINDOW_MS = 60_000;

const hits = new Map<string, { count: number; resetAt: number }>();

/** Per-instance limiter. Good enough for a handful of users; swap for a
 *  Postgres or KV counter if this ever runs on more than one instance. */
export function rateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= max) return false;

  entry.count += 1;
  return true;
}
