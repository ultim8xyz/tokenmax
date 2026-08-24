export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function shiftDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Counts back from today, or from yesterday if today has not been synced yet,
 *  so checking your streak in the morning does not read as broken. */
export function streakFrom(dates: Set<string>, today = new Date()): number {
  let cursor = dates.has(isoDate(today)) ? today : shiftDays(today, -1);
  let streak = 0;

  while (dates.has(isoDate(cursor))) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}
