/**
 * The command onboarding tells people to run.
 *
 * Installed straight from git, not npm. `tokenmax` on npm belongs to an
 * unrelated package, and anything published to a public registry cannot be
 * reliably withdrawn — making the repo private revokes this instantly.
 *
 * The CLI lives in its own repo because npm cannot install from a subdirectory
 * of one. `scripts/publish-cli.sh` pushes `packages/cli` there as a subtree.
 */
export const CLI_SOURCE = "github:ultim8xyz/tokenmax-cli";

export function installCommand(subcommand = "login"): string {
  return `npx ${CLI_SOURCE} ${subcommand}`.trim();
}
