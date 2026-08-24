import { apiRequest } from "../lib/api.js";
import { loadConfig } from "../config.js";

const WINDOWS = [
  { key: "1d", label: "today" },
  { key: "7d", label: "last 7d" },
  { key: "30d", label: "last 30d" },
] as const;

interface WindowTotals {
  cost_usd: number;
  total_tokens: number;
  rank: number | null;
  sessions: number;
  interactive_sessions: number;
  projects: number;
  max_concurrent_sessions: number;
}

interface StatusResponse {
  username: string | null;
  streak_days: number;
  max_downtime_seconds: number;
  windows: Record<string, WindowTotals>;
  devices: { device_name: string; last_seen_at: string; cost_usd_30d: number }[];
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDuration(seconds: number): string {
  if (seconds >= 86_400) return `${(seconds / 86_400).toFixed(1)}d`;
  if (seconds >= 3_600) return `${(seconds / 3_600).toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export async function statusCommand(apiUrl: string): Promise<void> {
  const config = loadConfig();
  if (!config) throw new Error("Not signed in. Run `tokenmax login`.");

  const status = await apiRequest<StatusResponse>(apiUrl, config, "/api/usage/status", {
    method: "GET",
  });

  console.log(
    `\n${status.username ?? "you"}   streak ${status.streak_days}d   ` +
      `longest quiet ${formatDuration(status.max_downtime_seconds)}`,
  );
  console.log(
    `\n  ${"".padEnd(9)} ${"spend".padStart(10)} ${"tokens".padStart(8)} ` +
      `${"yours".padStart(6)} ${"total".padStart(6)} ${"proj".padStart(5)} ${"peak".padStart(5)}  rank`,
  );

  for (const window of WINDOWS) {
    const totals = status.windows[window.key];
    if (!totals) continue;
    console.log(
      `  ${window.label.padEnd(9)} ${formatUsd(totals.cost_usd).padStart(10)} ` +
        `${formatTokens(totals.total_tokens).padStart(8)} ` +
        `${String(totals.interactive_sessions).padStart(6)} ` +
        `${String(totals.sessions).padStart(6)} ` +
        `${String(totals.projects).padStart(5)} ` +
        `${String(totals.max_concurrent_sessions).padStart(5)}  ` +
        `${totals.rank ?? "—"}`,
    );
  }

  if (status.devices.length > 0) {
    console.log("\n  devices (30d)");
    for (const device of status.devices) {
      const marker = device.device_name === config.device_name ? "*" : " ";
      console.log(
        `  ${marker} ${device.device_name.padEnd(20)} ${formatUsd(device.cost_usd_30d).padStart(10)}` +
          `   last seen ${device.last_seen_at.slice(0, 10)}`,
      );
    }
  }
  console.log("");
}
