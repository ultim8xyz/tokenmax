# tokenmax

Your own agent-usage tracker. A CLI reads what Claude Code, Codex, and friends
already wrote to disk, sums the day across every machine you code on, and posts
the totals to an instance you run.

Prompts, conversations, source, and file paths never leave the machine. What
crosses the wire is per-day numbers, model names, and a device label.

**Members only, not public.** Nothing is world readable and search engines are
excluded via `robots.txt`, but anyone who signs in with GitHub becomes a member.
Membership is a `profiles` row, and every read policy keys off it.

## Layout

| Path | What it is |
|---|---|
| `packages/cli` | The `tokenmax` command. Collects and pushes. |
| `apps/web` | Next.js app: leaderboard, profiles, CLI device login, API routes. |
| `supabase` | Schema migration and the contract tests. |

## Multi-device

`device_usage` is the source of truth, keyed on `(user, date, device)`. Each
machine writes only its own row; a database trigger recomputes the `daily_usage`
rollup for that day.

That gives two properties, both asserted in `supabase/tests/rollup.sql`:

- Two machines pushing the same day **sum**.
- One machine re-pushing a day **replaces** its own row, and nothing else.

A per-machine UUID lives in `~/.tokenmax/machine-id` and survives logout, so
re-authenticating a laptop does not turn it into a second device.

## What a day records

Two collectors, merged on the date:

- **ccusage** — tokens, cost, models, per-model breakdown
- **transcripts** — sessions, projects, peak concurrency, first and last turn,
  widest quiet stretch

Sessions split two ways. `entrypoint: "cli"` is a terminal you opened;
`sdk-*` is a session some agent spawned — subagents, workflows, `claude -p`.
Both are counted, separately.

A session stays live for 15 minutes after its most recent turn; peak concurrency
is the largest number live at once. Max downtime is the widest stretch with no
turn in it, within a day or across days.

The transcript collector reads `~/.claude/projects/**/*.jsonl` and emits counts.
No titles, no paths, no content.

## Windows

Every surface reports today, 7 days, and 30 days. `usage_date` is a whole day in
the *device's* timezone, so the shortest honest window is "today", not a rolling
24 hours.

Windows are lower-bounded only. A machine running ahead of UTC legitimately
reports tomorrow's date, and an upper bound would silently drop it.

## How the CLI is installed

```sh
npx github:ultim8xyz/tokenmax-cli setup <code>
```

The onboarding page mints the code and prints the whole command. Running it
links the machine and pushes in one step — no second browser trip, because the
page has already proved who you are. The code is single-use and expires in 30
minutes.

`tokenmax login` still exists for the type-the-code-in-a-browser flow.

No URL to supply: the instance is compiled into the CLI
(`packages/cli/src/config.ts`). `TOKENMAX_API_URL` still overrides it, which is
what local development uses.

From git, not npm. Two reasons: `tokenmax` on npm belongs to an unrelated
package, so `npx tokenmax` would run a stranger's code; and anything published
to a public registry cannot be reliably withdrawn, while making a repo private
revokes it immediately.

npm cannot install from a subdirectory of a repo, so the CLI has its own origin.
`scripts/publish-cli.sh` pushes `packages/cli` there as a git subtree — one
source of truth, one command to sync. `packages/cli/dist` is committed on
purpose, so installing needs no build toolchain.

The command lives in one constant: `apps/web/lib/console/cli.ts`.

## Onboarding

Signing in is not joining. A new member lands on `/onboarding` and stays there
until the CLI has actually reached the instance — the first successful push sets
`profiles.onboarded_at`, and only then do they appear on the leaderboard. An
account with no numbers behind it is not a competitor.

The page polls while it waits, so the terminal and the browser stay in sync
without a refresh.

GitHub supplies the avatar and the username. `display_name` is an optional alias
on top; blank means "use my username", and it is never overwritten by a later
sign-in.

## Membership

Signup is **open**: anyone who signs in with GitHub gets a profile.

- `TOKENMAX_OPEN_SIGNUP=0` shuts the door again and falls back to the invite
  list, which still exists underneath. Closing it is a config change, not a code
  change.
- `TOKENMAX_OWNER_GITHUB_LOGIN` names the account that becomes owner on first
  sign-in. Only the owner sees the member list.
- With the door shut, an uninvited login finishes OAuth holding an `auth.users`
  row and no profile, which every read policy treats as a stranger.

`lib/admission.ts` is the single branch that decides who gets in, pulled out of
the callback so it can be tested without an OAuth round trip.

## The instance

| | |
|---|---|
| Supabase org | `orchard` (`mseonbysgjysuzjwfgju`) |
| Supabase project | `tokenmax` (`exctmspjcaezrsnahkcw`), us-east-1, free plan |
| Schema | applied |
| Postgres password | `op://orchard/tokenmax Postgres/password` |
| anon + service_role | `op://orchard/tokenmax Supabase keys` |
| Personal access token | `op://orchard/Supabase PAT (tokenmax)/credential` |
| Owner GitHub login | `ultim8xyz` |
| Vercel project | `ultim8/tokenmax` |
| Live URL | `https://tokenmax-app.vercel.app` (`tokenmax.vercel.app` was taken) |
| CLI signing key | `op://orchard/tokenmax CLI JWT secret/password` |
| GitHub OAuth app | `op://orchard/tokenmax GitHub OAuth` |

Nothing resolves those references except the process that needs the value.

## Setup

Done already: the project exists and the schema is applied. What remains:

1. Turn off Vercel Deployment Protection for this project. It is on by default
   and currently bounces every route to Vercel SSO, which would lock out the CLI
   and anyone without a Vercel account.
2. Create a GitHub OAuth app with homepage `https://tokenmax-app.vercel.app`.
   Its **Authorization callback URL** is Supabase's, not this app's:
   ```
   https://exctmspjcaezrsnahkcw.supabase.co/auth/v1/callback
   ```
   Then paste its client id and secret into the GitHub provider in the Supabase
   dashboard. `/callback` in this app is only where Supabase sends the browser
   afterwards, and it belongs in Supabase's redirect allow-list instead.
3. Run the CLI against it:
   ```sh
   cd packages/cli && bun install && bun run build
   TOKENMAX_API_URL=https://tokenmax-app.vercel.app node dist/index.js
   ```

Production environment variables are already set on Vercel, each sourced from
1Password. For local work, copy `apps/web/.env.example` to `.env.local` and fill
it from the same references.

Re-applying the schema, or running the contract tests against the live database:

```sh
PGPASSWORD="op://orchard/tokenmax Postgres/password" opx run -- \
  psql -h aws-0-us-east-1.pooler.supabase.com -p 5432 \
       -U postgres.exctmspjcaezrsnahkcw -d postgres \
       -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
```

## Before it is deployed

The collector half works standalone. This needs nothing running:

```sh
cd packages/cli && bun install && bun run build
node dist/index.js push --dry-run --days 7
```

## Tests

```sh
bun run test                                              # 75 CLI + web unit tests
psql "$DATABASE_URL" -f supabase/tests/rollup.sql         # multi-device contract
psql "$DATABASE_URL" -f supabase/tests/rls.sql            # access contract
psql "$DATABASE_URL" -f supabase/tests/windows.sql        # window boundaries
```

Both SQL tests roll back when they finish, so they are safe to run repeatedly
against a real database.

## What is verified, and what is not

Verified against the live Supabase database, and against a local PostgreSQL 16
before that: the multi-device rollup contract, the access contract (anon reads
nothing, an uninvited GitHub account reads nothing, members never see each
other's per-device rows), and the leaderboard window boundaries. All three were
mutation-checked locally: weakening a policy or moving a window edge makes the
test fail.

Verified in unit tests: CLI token signing and forgery rejection, GitHub login
validation, streak arithmetic, push-range resolution, peak-concurrency and
downtime arithmetic, and the two-collector merge. Collection was run against
real local ccusage data, and the production build is clean.

Verified against the live instance: GitHub sign-in, a CLI push, the status
read-back with ranks, and the onboarding gate — a member with no sync is absent
from the leaderboard, and the first push admits them.

Not verified: the CLI's own browser login round trip, and the invite flow.

## Trust

`ccusage` is pinned to an exact version rather than a range, and the CLI refuses
to run if the installed version differs — an unpinned range is the one thing
that would let unaudited code in on the next `install`. `ccusage` ships a
prebuilt native binary; that binary is the only dependency here that has not
been read.
