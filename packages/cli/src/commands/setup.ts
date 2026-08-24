import { apiRequestNoAuth } from "../lib/api.js";
import { getDeviceName, getMachineId, loadConfig, saveConfig } from "../config.js";
import { pushCommand } from "./push.js";

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
