import { spawn } from "node:child_process";
import { apiRequestNoAuth } from "../lib/api.js";
import { getDeviceName, getMachineId, loadConfig, saveConfig } from "../config.js";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface InitResponse {
  code: string;
  verify_url: string;
  poll_secret: string;
}

interface PollResponse {
  status: "pending" | "used" | "expired";
  token?: string;
  username?: string | null;
}

function openBrowser(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;

  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];

  try {
    const child = spawn(command as string, args as string[], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Falling back to the printed URL is fine.
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function loginCommand(apiUrl: string): Promise<void> {
  const deviceName = getDeviceName();
  const init = await apiRequestNoAuth<InitResponse>(apiUrl, "/api/auth/cli/init", {
    method: "POST",
    body: JSON.stringify({ device_name: deviceName }),
  });

  console.log(`\nOpening ${init.verify_url}`);
  console.log(`If the browser does not open, paste that URL and confirm code ${init.code}\n`);
  openBrowser(init.verify_url);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await apiRequestNoAuth<PollResponse>(apiUrl, "/api/auth/cli/poll", {
      method: "POST",
      body: JSON.stringify({ code: init.code, poll_secret: init.poll_secret }),
    });

    if (poll.status === "expired") throw new Error("Login code expired. Run `tokenmax login` again.");
    if (poll.status === "used" && poll.token) {
      saveConfig({
        ...loadConfig(),
        token: poll.token,
        username: poll.username ?? null,
        device_id: getMachineId(),
        device_name: deviceName,
      });
      console.log(`Signed in as ${poll.username ?? "unknown"} on ${deviceName}.`);
      return;
    }
  }
  throw new Error("Timed out waiting for browser confirmation.");
}
