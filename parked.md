# Parked

Threads dropped deliberately, with the condition that would revive each one.

## ~~The arrival animation~~ — done 2026-08-24

Ported to `apps/web/lib/console/flight.ts`, wired to the "Enter tokenmax"
button. The study may still change it; re-extracting is the same one script.

## ~~Lines of code~~ — done 2026-08-24

Built: `packages/cli/src/lib/git.ts`, surfaced as cost per 1,000 lines.

Source decided: git, filtered on the `Co-Authored-By: Claude` trailer.
Transcripts lost because shell edits are invisible to them — the session that
built this repo wrote every file via `sed` and heredocs.

Author filtering was rejected: these repos carry three identities for one
person, including an unconfigured `jax@Jaxs-MacBook-Pro.local`.

The repo list needs no input. Every transcript turn records `cwd`, and
`git rev-parse --show-toplevel` resolves those to repo roots; non-repos like
`/tmp` fall out on their own. 18 distinct cwds in the last 30 days.

One catch found in the building: `%(trailers:...,valueonly)` strips the key, so
matching on `co-authored-by:` matched nothing. It matches `@anthropic.com` in
the trailer value instead.

## A collaborator who also uses Claude Code

**Revived 2026-08-24:** one of the two machines has a second OS user who commits
code, so a walked repo will have two Claude Code users in its history. The
condition this was parked against has fired.

Their commits carry the same `Co-Authored-By: Claude` trailer, so they would
land in your line counts. The fix is one clause: require the trailer *and* an
author on your identity list — which now needs that list to exist.

Usage stats are unaffected. `~/.claude/projects` and `~/.tokenmax/machine-id`
are both per-OS-user, so two users on one machine are already two devices under
whichever tokenmax account each signs into.

**Blocked on:** the git identities that count as you. Three are known from local
repos: `jax@Jaxs-MacBook-Pro.local`, `eight@ultim8.xyz`,
`data@bayviewholdingsgroup.com`.

## Cross-device project de-duplication

`daily_usage.projects` rolls up as MAX across devices, so a repo worked on from
two machines counts once and two different repos on two machines count as one.
Exact de-duplication means sending a fingerprint of each project path, which
breaks the promise that paths never leave the machine.

**Revive when:** a second device is actually syncing and the undercount shows up
in a number you care about.

## ~~The SQL contract tests can no longer run against production~~ — done 2026-08-29

Fixed rather than parked. Every count assertion is scoped to its own fixtures;
the ones expecting zero stay unscoped, because "sees nothing" is a stronger
claim when there is something real to see.

`windows.sql` turned out to be worse than fragile: its leaderboard assertions
read the whole view, and the fixture profile had no `onboarded_at`, which 0002
had added to the view's WHERE. Against the empty database it was written for,
the view returned nothing and every window assertion passed by matching no rows.
It had never tested anything.

`supabase/tests/run.sh` runs all three through the Management API, since psql is
not installed here. All three pass live, and each was mutation-checked.
