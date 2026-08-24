export function usd(value: number): string {
  if (value >= 1000) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${value.toFixed(2)}`;
}

export function tokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
