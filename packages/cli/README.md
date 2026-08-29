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
- a **daily job** at 21:00 — launchd on macOS, cron on Linux — as the floor
  under it.

`tokenmax auto` shows both and installs whichever is missing; `--off` removes
them.

Both run `~/.tokenmax/auto-push.sh`. That wrapper writes an absolute path to
node and to npx, because launchd and cron run with a near-empty PATH — no
Homebrew, often no node at all. A bare `npx` in there is why nothing ran.
Output, including a timestamp per run, lands in `~/.tokenmax/auto-push.log`.

## Files it owns

Both are mode `0600` inside a `0700` directory:

- `~/.tokenmax/config.json` — token, username, device id and name, last push date
- `~/.tokenmax/machine-id` — the per-machine UUID, kept across logout
- `~/.tokenmax/auto-push.sh` and `auto-push.log` — the daily sync and its output

## Source

| File | Role |
|---|---|
| `src/index.ts` | Argument parsing and dispatch |
| `src/config.ts` | Config and machine-id files |
| `src/lib/ccusage.ts` | Runs the pinned ccusage binary, parses its daily JSON |
| `src/lib/sessions.ts` | Reads local transcripts, derives session and project counts |
| `src/lib/api.ts` | Fetch wrapper with bearer auth and typed errors |
| `src/commands/` | `login` (device-code flow), `push`, `status` |

`ccusage` emits one `agent: "all"` roll-up row per day alongside per-agent rows.
The parser keeps only the roll-up; taking both would double count.

`sessions.ts` skips any transcript whose mtime predates the window, so a sync
opens a handful of files rather than all of them. Both collectors bucket by the
machine's local day so the two halves of a row describe the same window.

## Notes

The version of `ccusage` is pinned exactly and checked at runtime. If it does
not match, the CLI refuses to collect rather than run an unaudited build.
