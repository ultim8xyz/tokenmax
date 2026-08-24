#!/usr/bin/env node

// src/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir, hostname } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
var DIR_MODE = 448;
var FILE_MODE = 384;
var CONFIG_DIR = join(homedir(), ".tokenmax");
var CONFIG_FILE = join(CONFIG_DIR, "config.json");
var MACHINE_ID_FILE = join(CONFIG_DIR, "machine-id");
var DEFAULT_API_URL = process.env.TOKENMAX_API_URL ?? "http://localhost:3000";
function ensureDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: DIR_MODE });
}
function getMachineId() {
  ensureDir();
  if (existsSync(MACHINE_ID_FILE)) {
    const existing = readFileSync(MACHINE_ID_FILE, "utf-8").trim();
    if (existing) return existing;
  }
  const id = randomUUID();
  writeFileSync(MACHINE_ID_FILE, id, { encoding: "utf-8", mode: FILE_MODE });
  return id;
}
function getDeviceName() {
  return hostname();
}
function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    if (typeof parsed.token !== "string" || !parsed.token) return null;
    return {
      token: parsed.token,
      username: typeof parsed.username === "string" ? parsed.username : null,
      device_id: typeof parsed.device_id === "string" ? parsed.device_id : getMachineId(),
      device_name: typeof parsed.device_name === "string" ? parsed.device_name : getDeviceName(),
      last_push_date: typeof parsed.last_push_date === "string" ? parsed.last_push_date : void 0
    };
  } catch {
    return null;
  }
}
function saveConfig(config) {
  ensureDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    encoding: "utf-8",
    mode: FILE_MODE
  });
}

// src/commands/login.ts
import { spawn } from "child_process";

// src/lib/api.ts
var ApiError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
  status;
};
async function request(apiUrl, path, init, token) {
  const headers = {
    "content-type": "application/json",
    ...init.headers
  };
  if (token) headers.authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(new URL(path, apiUrl), { ...init, headers });
  } catch (err) {
    throw new ApiError(`Could not reach ${apiUrl}: ${err.message}`, 0);
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`Bad response from ${path} (${res.status})`, res.status);
  }
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : `${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body;
}
function apiRequestNoAuth(apiUrl, path, init) {
  return request(apiUrl, path, init);
}
function apiRequest(apiUrl, config, path, init) {
  return request(apiUrl, path, init, config.token);
}

// src/commands/login.ts
var POLL_INTERVAL_MS = 2e3;
var POLL_TIMEOUT_MS = 5 * 60 * 1e3;
function openBrowser(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
  const [command, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
    });
    child.unref();
  } catch {
  }
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function loginCommand(apiUrl) {
  const deviceName = getDeviceName();
  const init = await apiRequestNoAuth(apiUrl, "/api/auth/cli/init", {
    method: "POST",
    body: JSON.stringify({ device_name: deviceName })
  });
  console.log(`
Opening ${init.verify_url}`);
  console.log(`If the browser does not open, paste that URL and confirm code ${init.code}
`);
  openBrowser(init.verify_url);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await apiRequestNoAuth(apiUrl, "/api/auth/cli/poll", {
      method: "POST",
      body: JSON.stringify({ code: init.code, poll_secret: init.poll_secret })
    });
    if (poll.status === "expired") throw new Error("Login code expired. Run `tokenmax login` again.");
    if (poll.status === "used" && poll.token) {
      saveConfig({
        ...loadConfig(),
        token: poll.token,
        username: poll.username ?? null,
        device_id: getMachineId(),
        device_name: deviceName
      });
      console.log(`Signed in as ${poll.username ?? "unknown"} on ${deviceName}.`);
      return;
    }
  }
  throw new Error("Timed out waiting for browser confirmation.");
}

// src/lib/ccusage.ts
import { execFile } from "child_process";
import { readFileSync as readFileSync2 } from "fs";
import { createRequire } from "module";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
var EXPECTED_VERSION = "20.0.20";
var MAX_BUFFER = 20 * 1024 * 1024;
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function strings(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function resolveCli() {
  const require2 = createRequire(import.meta.url);
  const manifestPath = require2.resolve("ccusage/package.json");
  const manifest = JSON.parse(readFileSync2(manifestPath, "utf-8"));
  const version = typeof manifest.version === "string" ? manifest.version : "unknown";
  if (version !== EXPECTED_VERSION) {
    throw new Error(
      `ccusage ${version} is installed but tokenmax pins ${EXPECTED_VERSION}. Reinstall dependencies rather than running an unaudited version.`
    );
  }
  return { entry: require2.resolve("ccusage/src/cli.js"), version };
}
function parseBreakdown(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((row) => ({
    model: typeof row.modelName === "string" ? row.modelName : "unknown",
    inputTokens: num(row.inputTokens),
    outputTokens: num(row.outputTokens),
    cacheCreationTokens: num(row.cacheCreationTokens),
    cacheReadTokens: num(row.cacheReadTokens),
    costUSD: num(row.cost ?? row.costUSD)
  }));
}
function parseDaily(raw) {
  const parsed = JSON.parse(raw);
  const rows = isRecord(parsed) && Array.isArray(parsed.daily) ? parsed.daily : [];
  const byDate = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!isRecord(row)) continue;
    if (row.agent !== "all") continue;
    const date = typeof row.period === "string" ? row.period : void 0;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const inputTokens = num(row.inputTokens);
    const outputTokens = num(row.outputTokens);
    const cacheCreationTokens = num(row.cacheCreationTokens);
    const cacheReadTokens = num(row.cacheReadTokens);
    const totalTokens = num(row.totalTokens);
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    byDate.set(date, {
      date,
      agents: strings(metadata.agents),
      models: strings(row.modelsUsed),
      inputTokens,
      outputTokens,
      reasoningOutputTokens: Math.max(
        totalTokens - inputTokens - outputTokens - cacheCreationTokens - cacheReadTokens,
        0
      ),
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD: num(row.totalCost ?? row.costUSD),
      modelBreakdown: parseBreakdown(row.modelBreakdowns)
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
async function collectDaily(since, until) {
  const { entry } = resolveCli();
  const args = [entry, "daily", "--json"];
  if (since) args.push("--since", since.replace(/-/g, ""));
  if (until) args.push("--until", until.replace(/-/g, ""));
  const { stdout } = await execFileAsync(process.execPath, args, {
    maxBuffer: MAX_BUFFER,
    encoding: "utf-8"
  });
  return parseDaily(stdout);
}

// src/lib/sessions.ts
import { createReadStream } from "fs";
import { readdir, stat } from "fs/promises";
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
import { createInterface } from "readline";
var DEFAULT_TTL_SECONDS = 15 * 60;
var PROJECTS_DIR = join2(homedir2(), ".claude", "projects");
var TURN_TYPES = /* @__PURE__ */ new Set(["user", "assistant"]);
function localDate(at) {
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function maxConcurrent(turns, ttlSeconds) {
  const ttl = ttlSeconds * 1e3;
  const spans = [];
  const bySession = /* @__PURE__ */ new Map();
  for (const turn of turns) {
    const list = bySession.get(turn.session);
    if (list) list.push(turn.at);
    else bySession.set(turn.session, [turn.at]);
  }
  for (const times of bySession.values()) {
    times.sort((a, b) => a - b);
    let start = times[0];
    let end = start + ttl;
    for (const at of times.slice(1)) {
      if (at <= end) {
        end = at + ttl;
        continue;
      }
      spans.push([start, end]);
      start = at;
      end = at + ttl;
    }
    spans.push([start, end]);
  }
  const edges = spans.flatMap(([start, end]) => [
    { at: start, delta: 1 },
    { at: end, delta: -1 }
  ]).sort((a, b) => a.at - b.at || a.delta - b.delta);
  let live = 0;
  let peak = 0;
  for (const edge of edges) {
    live += edge.delta;
    if (live > peak) peak = live;
  }
  return peak;
}
function summarize(turns, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const byDate = /* @__PURE__ */ new Map();
  for (const turn of turns) {
    const date = localDate(turn.at);
    const list = byDate.get(date);
    if (list) list.push(turn);
    else byDate.set(date, [turn]);
  }
  const out = [];
  for (const [date, dayTurns] of byDate) {
    const times = dayTurns.map((t) => t.at).sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap > maxGap) maxGap = gap;
    }
    out.push({
      date,
      sessions: new Set(dayTurns.map((t) => t.session)).size,
      interactiveSessions: new Set(
        dayTurns.filter((t) => t.interactive).map((t) => t.session)
      ).size,
      projects: new Set(dayTurns.map((t) => t.project)).size,
      maxConcurrentSessions: maxConcurrent(dayTurns, ttlSeconds),
      firstActivityAt: new Date(times[0]).toISOString(),
      lastActivityAt: new Date(times[times.length - 1]).toISOString(),
      maxGapSeconds: Math.round(maxGap / 1e3)
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
async function readTurns(path, project, from, to) {
  const turns = [];
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf-8" }),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!TURN_TYPES.has(String(row.type))) continue;
    const timestamp = row.timestamp;
    const session = row.sessionId;
    if (typeof timestamp !== "string" || typeof session !== "string") continue;
    const at = Date.parse(timestamp);
    if (Number.isNaN(at) || at < from || at > to) continue;
    turns.push({
      session,
      project: typeof row.cwd === "string" ? row.cwd : project,
      at,
      interactive: row.entrypoint === "cli"
    });
  }
  return turns;
}
async function collectSessions(since, until, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const from = (/* @__PURE__ */ new Date(`${since}T00:00:00`)).getTime();
  const to = (/* @__PURE__ */ new Date(`${until}T23:59:59.999`)).getTime();
  let projectDirs;
  try {
    projectDirs = (await readdir(PROJECTS_DIR, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
  const turns = [];
  for (const project of projectDirs) {
    const dir = join2(PROJECTS_DIR, project);
    let files;
    try {
      files = (await readdir(dir)).filter((name) => name.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files) {
      const path = join2(dir, file);
      try {
        if ((await stat(path)).mtimeMs < from) continue;
        turns.push(...await readTurns(path, project, from, to));
      } catch {
        continue;
      }
    }
  }
  return summarize(turns, ttlSeconds);
}

// src/commands/push.ts
var MAX_BACKFILL_DAYS = 30;
var EMPTY_SESSIONS = {
  sessions: 0,
  interactiveSessions: 0,
  projects: 0,
  maxConcurrentSessions: 0,
  firstActivityAt: null,
  lastActivityAt: null,
  maxGapSeconds: 0
};
var EMPTY_USAGE = {
  agents: [],
  models: [],
  inputTokens: 0,
  outputTokens: 0,
  reasoningOutputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  costUSD: 0,
  modelBreakdown: []
};
function mergeByDate(usage, sessions) {
  const byDate = /* @__PURE__ */ new Map();
  for (const entry of usage) {
    byDate.set(entry.date, { ...entry, ...EMPTY_SESSIONS });
  }
  for (const stat2 of sessions) {
    const existing = byDate.get(stat2.date) ?? { date: stat2.date, ...EMPTY_USAGE, ...EMPTY_SESSIONS };
    byDate.set(stat2.date, {
      ...existing,
      sessions: stat2.sessions,
      interactiveSessions: stat2.interactiveSessions,
      projects: stat2.projects,
      maxConcurrentSessions: stat2.maxConcurrentSessions,
      firstActivityAt: stat2.firstActivityAt,
      lastActivityAt: stat2.lastActivityAt,
      maxGapSeconds: stat2.maxGapSeconds
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function shiftDays(d, days) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
function resolveRange(options, config, today = /* @__PURE__ */ new Date()) {
  const untilDate = isoDate(today);
  if (options.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error("--date must be YYYY-MM-DD");
    return { since: options.date, until: options.date };
  }
  if (options.days !== void 0) {
    if (!Number.isInteger(options.days) || options.days < 1 || options.days > MAX_BACKFILL_DAYS) {
      throw new Error(`--days must be between 1 and ${MAX_BACKFILL_DAYS}`);
    }
    return { since: isoDate(shiftDays(today, -(options.days - 1))), until: untilDate };
  }
  const floor = isoDate(shiftDays(today, -MAX_BACKFILL_DAYS));
  const last = config.last_push_date;
  const since = last && last > floor ? last : floor;
  return { since, until: untilDate };
}
function formatUsd(value) {
  return `$${value.toFixed(2)}`;
}
function formatTokens(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}
function printEntries(entries) {
  for (const entry of entries) {
    console.log(
      `  ${entry.date}  ${formatUsd(entry.costUSD).padStart(9)}  ${formatTokens(entry.totalTokens).padStart(7)}  ${String(entry.interactiveSessions).padStart(3)} yours / ${String(entry.sessions).padStart(4)} total  ${String(entry.projects).padStart(2)} proj  peak ${String(entry.maxConcurrentSessions).padStart(3)}`
    );
  }
}
async function pushCommand(options, apiUrl) {
  const config = loadConfig();
  if (!config && !options.dryRun) throw new Error("Not signed in. Run `tokenmax login`.");
  const identity = config ?? {
    token: "",
    username: null,
    device_id: "",
    device_name: getDeviceName()
  };
  const { since, until } = resolveRange(options, identity);
  const [usage, sessions] = await Promise.all([
    collectDaily(since, until),
    collectSessions(since, until)
  ]);
  const entries = mergeByDate(usage, sessions);
  if (entries.length === 0) {
    console.log(`No usage found between ${since} and ${until}.`);
    return;
  }
  if (options.dryRun) {
    console.log(`
Would submit ${entries.length} day(s) as ${identity.device_name}:`);
    printEntries(entries);
    const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
    const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
    console.log(
      `  ${"total".padEnd(10)} ${formatUsd(totalCost).padStart(9)}  ${formatTokens(totalTokens).padStart(7)}`
    );
    console.log(
      config ? "\n(dry run \u2014 nothing submitted)" : "\n(dry run \u2014 not signed in, nothing submitted)"
    );
    return;
  }
  const device = identity.device_id || getMachineId();
  const response = await apiRequest(apiUrl, identity, "/api/usage/submit", {
    method: "POST",
    body: JSON.stringify({
      device_id: device,
      device_name: identity.device_name,
      entries
    })
  });
  saveConfig({ ...identity, device_id: device, last_push_date: until });
  console.log(`
Synced ${response.accepted} day(s) from ${identity.device_name}:`);
  printEntries(entries);
  if (response.devices.length > 1) {
    console.log("\nProfile total across devices:");
    for (const device2 of response.devices) {
      console.log(`  ${device2.device_name.padEnd(20)} ${formatUsd(device2.cost_usd)}`);
    }
    console.log(
      `  ${"all".padEnd(20)} ${formatUsd(response.totals.cost_usd)} (${formatTokens(response.totals.total_tokens)} tokens)`
    );
  }
}

// src/commands/status.ts
var WINDOWS = [
  { key: "1d", label: "today" },
  { key: "7d", label: "last 7d" },
  { key: "30d", label: "last 30d" }
];
function formatUsd2(value) {
  return `$${value.toFixed(2)}`;
}
function formatDuration(seconds) {
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)}d`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}
function formatTokens2(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}
async function statusCommand(apiUrl) {
  const config = loadConfig();
  if (!config) throw new Error("Not signed in. Run `tokenmax login`.");
  const status = await apiRequest(apiUrl, config, "/api/usage/status", {
    method: "GET"
  });
  console.log(
    `
${status.username ?? "you"}   streak ${status.streak_days}d   longest quiet ${formatDuration(status.max_downtime_seconds)}`
  );
  console.log(
    `
  ${"".padEnd(9)} ${"spend".padStart(10)} ${"tokens".padStart(8)} ${"yours".padStart(6)} ${"total".padStart(6)} ${"proj".padStart(5)} ${"peak".padStart(5)}  rank`
  );
  for (const window of WINDOWS) {
    const totals = status.windows[window.key];
    if (!totals) continue;
    console.log(
      `  ${window.label.padEnd(9)} ${formatUsd2(totals.cost_usd).padStart(10)} ${formatTokens2(totals.total_tokens).padStart(8)} ${String(totals.interactive_sessions).padStart(6)} ${String(totals.sessions).padStart(6)} ${String(totals.projects).padStart(5)} ${String(totals.max_concurrent_sessions).padStart(5)}  ${totals.rank ?? "\u2014"}`
    );
  }
  if (status.devices.length > 0) {
    console.log("\n  devices (30d)");
    for (const device of status.devices) {
      const marker = device.device_name === config.device_name ? "*" : " ";
      console.log(
        `  ${marker} ${device.device_name.padEnd(20)} ${formatUsd2(device.cost_usd_30d).padStart(10)}   last seen ${device.last_seen_at.slice(0, 10)}`
      );
    }
  }
  console.log("");
}

// src/index.ts
var HELP = `tokenmax \u2014 push AI coding-agent usage to your own instance

Usage
  tokenmax                 Sign in if needed, then sync everything since the last push
  tokenmax login           Authenticate this device in the browser
  tokenmax push [options]  Push usage
  tokenmax status          Streak, weekly spend, rank, and per-device split

Options
  --date YYYY-MM-DD        Push one specific day
  --days N                 Push the last N days (max 30)
  --dry-run                Print the numbers locally; no sign-in, nothing sent
  --api-url URL            Override the instance URL (or set TOKENMAX_API_URL)
  --help

Every machine you log in from gets its own device id, so days are summed
across devices and a re-push from one device replaces only its own row.
`;
function parseArgs(argv) {
  const options = { dryRun: false, apiUrl: DEFAULT_API_URL, help: false };
  let command;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === void 0) continue;
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--date") options.date = argv[++i];
    else if (arg === "--days") options.days = Number(argv[++i]);
    else if (arg === "--api-url") options.apiUrl = argv[++i] ?? options.apiUrl;
    else if (!arg.startsWith("-") && command === void 0) command = arg;
  }
  return { command, options };
}
async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (options.help || command === "help") {
    console.log(HELP);
    return;
  }
  switch (command) {
    case "login":
      await loginCommand(options.apiUrl);
      return;
    case "status":
      await statusCommand(options.apiUrl);
      return;
    case void 0:
    case "push": {
      if (!loadConfig() && !options.dryRun) await loginCommand(options.apiUrl);
      await pushCommand(
        { date: options.date, days: options.days, dryRun: options.dryRun },
        options.apiUrl
      );
      return;
    }
    default:
      console.error(`Unknown command: ${command}
`);
      console.log(HELP);
      process.exitCode = 1;
  }
}
main().catch((err) => {
  console.error(`
${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
