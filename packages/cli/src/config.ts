import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export const CONFIG_DIR = join(homedir(), ".tokenmax");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const MACHINE_ID_FILE = join(CONFIG_DIR, "machine-id");

export const DEFAULT_API_URL =
  process.env.TOKENMAX_API_URL ?? "http://localhost:3000";

export interface Config {
  token: string;
  username: string | null;
  /** Stable per-machine UUID. Two machines pushing the same date sum; the
   *  same machine re-pushing a date replaces. */
  device_id: string;
  device_name: string;
  last_push_date?: string;
}

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: DIR_MODE });
}

/** Survives logout, so a re-authenticated machine keeps its identity. */
export function getMachineId(): string {
  ensureDir();
  if (existsSync(MACHINE_ID_FILE)) {
    const existing = readFileSync(MACHINE_ID_FILE, "utf-8").trim();
    if (existing) return existing;
  }
  const id = randomUUID();
  writeFileSync(MACHINE_ID_FILE, id, { encoding: "utf-8", mode: FILE_MODE });
  return id;
}

export function getDeviceName(): string {
  return hostname();
}

export function loadConfig(): Config | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Partial<Config>;
    if (typeof parsed.token !== "string" || !parsed.token) return null;
    return {
      token: parsed.token,
      username: typeof parsed.username === "string" ? parsed.username : null,
      device_id: typeof parsed.device_id === "string" ? parsed.device_id : getMachineId(),
      device_name: typeof parsed.device_name === "string" ? parsed.device_name : getDeviceName(),
      last_push_date: typeof parsed.last_push_date === "string" ? parsed.last_push_date : undefined,
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  ensureDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    encoding: "utf-8",
    mode: FILE_MODE,
  });
}
