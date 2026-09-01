# supabase

## Migrations

Apply in filename order:

| File | What it adds |
|---|---|
| `0001_init.sql` | The whole schema |
| `0002_onboarding.sql` | `profiles.onboarded_at`, and the leaderboard filter that hides members who have never synced |
| `0004_lines.sql` | `lines_added`, `lines_removed`, `commits` |
| `0005_drop_invite_links.sql` | Drops `invite_links` and `redeem_invite_link` |

`0003` is missing on purpose: it added `invite_links`, signup opened before
anything called it, and `0005` removed it. It is deleted rather than kept so a
fresh database never creates a table only to drop it two files later — which is
also why `0005` guards every statement with `if exists`.

```sh
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

It expects the Supabase-managed `auth.users` table and `auth.uid()` to exist.

## Tables

| Table | Role |
|---|---|
| `profiles` | One per member. Its existence **is** membership; `onboarded_at` is proof the CLI arrived |
| `invites` | GitHub logins cleared to join but not signed in yet |
| `devices` | Machine names and last-seen, one row per `(user, device)` |
| `device_usage` | **Source of truth.** One row per `(user, date, device)` |
| `daily_usage` | Derived rollup per `(user, date)`, maintained by trigger |
| `cli_auth_codes` | Short-lived device-login codes; service role only |

The `leaderboard` view carries all three windows as columns on one row, so the
UI switches window without a second query.

`refresh_daily_usage(user, date)` recomputes one rollup from scratch, and the
`device_usage_rollup_trg` trigger fires it on every insert, update, and delete.
Recomputing rather than incrementing is what makes a re-push a replace.

## Row-level security

Nothing is readable by `anon`. `public.is_member()` — `security definer`, so it
can see `profiles` while `profiles`' own policies are being evaluated — is the
predicate behind every read:

| Table | Who can select |
|---|---|
| `profiles` | Members, plus your own row |
| `daily_usage` | Members, for listed profiles only, plus your own |
| `device_usage`, `devices` | The owner only. Machine names never leave |
| `invites`, `cli_auth_codes` | Nobody. Service role only, no policy defined |

There are deliberately **no** insert or update policies on the usage tables —
every write goes through a route handler using the service role, so the API is
the only way in.

## Tests

All three roll back when they finish, and every assertion is either scoped to
its own fixtures or expects zero, so they are safe to run repeatedly against a
database that has real members in it.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rollup.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/windows.sql
```

Without a Postgres client installed, `run.sh` sends the same files through the
Supabase Management API — the endpoint the migrations already go through. It
prints one line per file and exits non-zero on the first assertion that raises.

```sh
opx run --env-file=supabase/tests/pat.env -- supabase/tests/run.sh
```

A fixture profile needs `onboarded_at` set. `0002` added it to the
`leaderboard` WHERE, so a fixture without it is absent from the view and every
assertion scoped to that row passes by matching nothing — which is what
`windows.sql` was quietly doing.

- `rollup.sql` — two devices sum, a re-push replaces, a delete un-counts.
- `rls.sql` — anon sees nothing, an uninvited GitHub account sees nothing,
  members never see each other's device rows, a hidden member stays off the
  board but still sees itself.
- `windows.sql` — the `leaderboard` view's today / 7d / 30d edges, including
  that a device reporting tomorrow's date is kept rather than dropped.

`rollup.sql` also covers how session shape aggregates: sessions add up across
devices, while projects and peak concurrency take the maximum, because a
day-level peak summed across machines would be meaningless.

`rls.sql` needs the `anon` and `authenticated` roles and an `auth.uid()` that
reads `request.jwt.claim.sub`. A Supabase database already has both.
