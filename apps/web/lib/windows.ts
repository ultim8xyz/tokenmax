export const WINDOWS = [
  { key: "1d", label: "today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
] as const;

export type WindowKey = (typeof WINDOWS)[number]["key"];

export const DEFAULT_WINDOW: WindowKey = "7d";

export function parseWindow(value: unknown): WindowKey {
  return WINDOWS.some((w) => w.key === value) ? (value as WindowKey) : DEFAULT_WINDOW;
}

/** `usage_date` is a whole day in the device's own timezone, so the shortest
 *  window we can honestly offer is "today", not a rolling 24 hours. */
export function windowLabel(key: WindowKey): string {
  return WINDOWS.find((w) => w.key === key)!.label;
}
