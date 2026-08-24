import { DEFAULT_API_URL, loadConfig } from "./config.js";
import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";

const HELP = `tokenmax — push AI coding-agent usage to your own instance

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

interface Options {
  date?: string;
  days?: number;
  dryRun: boolean;
  apiUrl: string;
  help: boolean;
}

function parseArgs(argv: string[]): { command: string | undefined; options: Options } {
  const options: Options = { dryRun: false, apiUrl: DEFAULT_API_URL, help: false };
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--date") options.date = argv[++i];
    else if (arg === "--days") options.days = Number(argv[++i]);
    else if (arg === "--api-url") options.apiUrl = argv[++i] ?? options.apiUrl;
    else if (!arg.startsWith("-") && command === undefined) command = arg;
  }

  return { command, options };
}

async function main(): Promise<void> {
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
    case undefined:
    case "push": {
      if (!loadConfig() && !options.dryRun) await loginCommand(options.apiUrl);
      await pushCommand(
        { date: options.date, days: options.days, dryRun: options.dryRun },
        options.apiUrl,
      );
      return;
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
