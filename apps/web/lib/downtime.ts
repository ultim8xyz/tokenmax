export interface ActivityDay {
  usage_date: string;
  first_activity_at: string | null;
  last_activity_at: string | null;
  max_gap_seconds: number;
}

/**
 * Longest stretch with no turn in it, across the whole history.
 *
 * Two kinds of candidate: a quiet stretch inside one day, which the CLI already
 * measured, and the stretch from one day's last turn to the next day's first.
 * Days with no activity at all simply widen the second kind.
 *
 * On a day where two machines were both active the within-day figure is each
 * machine's own quiet stretch, so it can overstate: the other machine may have
 * been busy through it.
 */
export function maxDowntimeSeconds(days: ActivityDay[]): number {
  const active = days
    .filter((d) => d.first_activity_at && d.last_activity_at)
    .sort((a, b) => a.usage_date.localeCompare(b.usage_date));

  let max = 0;
  for (const day of active) {
    if (day.max_gap_seconds > max) max = day.max_gap_seconds;
  }

  for (let i = 1; i < active.length; i++) {
    const previous = Date.parse(active[i - 1]!.last_activity_at!);
    const next = Date.parse(active[i]!.first_activity_at!);
    if (Number.isNaN(previous) || Number.isNaN(next)) continue;
    const gap = Math.round((next - previous) / 1000);
    if (gap > max) max = gap;
  }

  return max;
}
