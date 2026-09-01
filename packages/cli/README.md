# tokenmax CLI

Collects local agent usage and pushes the daily totals to your instance.

```sh
npx github:ultim8xyz/tokenmax-cli setup <code>
```

The instance is compiled in; `TOKENMAX_API_URL` overrides it for local work.

Installed from git rather than npm: `tokenmax` on npm is an unrelated package,
and a git install can be revoked by making the repo private. `dist/` is
committed so the install needs no build toolchain.

This directory is mirrored to `ultim8xyz/tokenmax-cli` by
`scripts/publish-cli.sh`; edit it here.

## Commands

| Command | What it does |
|---|---|
| `tokenmax` | Logs in if needed, then pushes everything since the last sync |
| `tokenmax setup <code>` | Links this machine from the onboarding page's code, then pushes |
| `tokenmax login` | Authenticates this device in the browser instead |
| `tokenmax push` | Pushes usage; see the flags below |
| `tokenmax status` | Streak; spend, tokens and rank for today / 7d / 30d; per-device split |

Flags: `--date YYYY-MM-DD`, `--days N` (max 30), `--dry-run`, `--api-url URL`.

`TOKENMAX_API_URL` overrides the compiled-in instance.

## Before you have an instance

`--dry-run` reads local data and prints the totals. It needs no sign-in, no
server, and no network, and it writes nothing to disk — not even the machine id.

```sh
tokenmax push --dry-run --days 7
```

Everything else needs an instance to talk to.

## Staying current

`setup` installs two things as well as pushing once:

- a **Claude Code `SessionEnd` hook**, so a push follows every session. Async,
  so nothing waits on the network to close a session.
- a **recurring job** at 00:00, 06:00, 12:00 and 18:00 — launchd on macOS, cron
  on Linux — as the floor under it.

`tokenmax auto` shows both and reinstalls both; `--off` removes them.

Both run `~/.tokenmax/auto-push.sh`. That wrapper writes an absolute path to
node and to npx, because launchd and cron run with a near-empty PATH — no
Homebrew, often no node at all. A bare `npx` in there is why nothing ran.
Output, including a timestamp per run, lands in `~/.tokenmax/auto-push.log`.

### A machine that was off

A push covers everything since the last one, up to a 30-day backfill, so a
missed tick costs lag and nothing else — the next run carries the gap.

Beyond that, launchd runs a calendar job it slept through as soon as the machine
wakes, and `RunAtLoad` covers a machine that was fully off by pushing at login.
cron drops a tick it slept through, so a `@reboot` line stands in for the same
thing.

### Updating itself

The wrapper resolves `github:ultim8xyz/tokenmax-cli` from the network on every
run, so the CLI is always the latest commit on the default branch. Nothing is
pinned and there is nothing to update by hand.

The wrapper and the schedule around it are generated once at install, so they
would otherwise stay frozen at whatever version wrote them. Every push compares
what is on disk against what the running version would write, and reinstalls
when they differ — which is how a changed schedule, or a node that moved,
reaches a machine nobody runs a command on.

## Files it owns

Both are mode `0600` inside a `0700` directory:

- `~/.tokenmax/config.json` — token, username, device id and name, last push date
- `~/.tokenmax/machine-id` — the per-machine UUID, kept across logout
- `~/.tokenmax/auto-push.sh` and `auto-push.log` — the automatic sync and its output

## Source

| File | Role |
|---|---|
| `src/index.ts` | Argument parsing and dispatch |
| `src/config.ts` | Config and machine-id files |
| `src/lib/ccusage.ts` | Runs the pinned ccusage binary, parses its daily JSON |
| `src/lib/sessions.ts` | Reads local transcripts, derives session and project counts |
| `src/lib/git.ts` | Lines changed, from the repos the transcripts point at |
| `src/lib/scheduler.ts` | The wrapper script and the launchd/cron schedule |
| `src/lib/hooks.ts` | The Claude Code `SessionEnd` hook |
| `src/lib/api.ts` | Fetch wrapper with bearer auth and typed errors |
| `src/commands/` | `setup`, `login` (device-code flow), `push`, `status`, `auto` |

`ccusage` emits one `agent: "all"` roll-up row per day alongside per-agent rows.
The parser keeps only the roll-up; taking both would double count.

`sessions.ts` skips any transcript whose mtime predates the window, so a sync
opens a handful of files rather than all of them. Both collectors bucket by the
machine's local day so the two halves of a row describe the same window, and
`resolveRange` picks the window in local days for the same reason: resolved in
UTC, it asks for tomorrow west of UTC every evening and never comes back for the
hours it skipped.

## Notes

The version of `ccusage` is pinned exactly and checked at runtime. If it does
not match, the CLI refuses to collect rather than run an unaudited build.
