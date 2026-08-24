# supabase

## Migrations

Apply in filename order:

| File | What it adds |
|---|---|
| `0001_init.sql` | The whole schema |
| `0002_onboarding.sql` | `profiles.onboarded_at`, and the leaderboard filter that hides members who have never synced |

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

Both roll back when they finish, so they are safe to run repeatedly against a
real database.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rollup.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/windows.sql
```

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
