import { apiRequestNoAuth } from "../lib/api.js";
import { getDeviceName, getMachineId, loadConfig, saveConfig } from "../config.js";
import { pushCommand } from "./push.js";
import { SCHEDULE_LABEL, install as installSchedule, isInstalled } from "../lib/scheduler.js";
import { hookInstalled, installHook } from "../lib/hooks.js";

interface RedeemResponse {
  token: string;
  username: string | null;
}

/**
 * One-shot enrolment: redeem the code the web page issued, then push.
 *
 * No browser round trip — the page that printed the code already proved who you
 * are, so asking the terminal to open a tab and ask again is ceremony.
 */
export async function setupCommand(code: string, apiUrl: string): Promise<void> {
  if (!code) {
    throw new Error("Usage: tokenmax setup <code>  — copy the command from your onboarding page.");
  }

  const deviceName = getDeviceName();
  const redeemed = await apiRequestNoAuth<RedeemResponse>(apiUrl, "/api/auth/cli/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  saveConfig({
    ...loadConfig(),
    token: redeemed.token,
    username: redeemed.username,
    device_id: getMachineId(),
    device_name: deviceName,
  });

  console.log(`\nLinked ${deviceName} to ${redeemed.username ?? "your account"}.`);

  const pushed = await pushCommand({}, apiUrl);

  // Adding a machine means adding it for good, not once. Two mechanisms: a
  // session hook for freshness, a recurring job as the floor under it. Both
  // are rewritten unconditionally so a re-run repairs a stale install.
  const scheduler = installSchedule();
  const hook = installHook();

  const on: string[] = [];
  if (scheduler || isInstalled()) on.push(SCHEDULE_LABEL);
  if (hook || hookInstalled()) on.push("after every Claude Code session");
  console.log(
    on.length
      ? `\nSyncing ${on.join(" and ")}. Turn it off with \`tokenmax auto --off\`.`
      : "\nNothing scheduled here — run `tokenmax` when you want to sync.",
  );
  if (pushed === 0) {
    // Membership is gated on a real push, so there is nothing to celebrate yet.
    console.log(
      "\nThis machine is linked, but it has no agent usage to report yet." +
        "\nUse Claude Code or Codex here, then run `tokenmax` again.",
    );
    return;
  }

  console.log("\nYour onboarding page has already noticed. You can go back to it.");
}
