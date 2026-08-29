import { DEFAULT_API_URL, loadConfig } from "./config.js";
import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { autoCommand } from "./commands/auto.js";
import { setupCommand } from "./commands/setup.js";
import { statusCommand } from "./commands/status.js";

const HELP = `tokenmax — push AI coding-agent usage to your own instance

Usage
  tokenmax                 Sign in if needed, then sync everything since the last push
  tokenmax setup <code>    Link this machine using the code from your onboarding page
  tokenmax login           Authenticate this device in the browser instead
  tokenmax push [options]  Push usage
  tokenmax status          Streak, weekly spend, rank, and per-device split
  tokenmax auto [--off]    Show, install, or remove the automatic sync

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
  off: boolean;
  apiUrl: string;
  help: boolean;
}

function parseArgs(argv: string[]): {
  command: string | undefined;
  arg: string | undefined;
  options: Options;
} {
  const options: Options = { dryRun: false, off: false, apiUrl: DEFAULT_API_URL, help: false };
  let command: string | undefined;
  let arg: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;

    if (token === "--help" || token === "-h") options.help = true;
    else if (token === "--dry-run") options.dryRun = true;
    else if (token === "--off") options.off = true;
    else if (token === "--date") options.date = argv[++i];
    else if (token === "--days") options.days = Number(argv[++i]);
    else if (token === "--api-url") options.apiUrl = argv[++i] ?? options.apiUrl;
    else if (!token.startsWith("-") && command === undefined) command = token;
    else if (!token.startsWith("-") && arg === undefined) arg = token;
  }

  return { command, arg, options };
}

async function main(): Promise<void> {
  const { command, arg, options } = parseArgs(process.argv.slice(2));

  if (options.help || command === "help") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "setup":
      await setupCommand(arg ?? "", options.apiUrl);
      return;
    case "auto":
      autoCommand(options.off);
      return;
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
