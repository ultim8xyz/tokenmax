# tokenmax web

Next.js app: the leaderboard, profiles, browser sign-in, the CLI device-login
screen, invite management, and the API the CLI talks to.

Every route except `/login` requires **membership**, not just a session — see
[Access](#access).

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | members | Leaderboard over listed members; `?w=1d\|7d\|30d` |
| `/u/[username]` | members | 30-day bars; spend and tokens for today, 7d, and 30d |
| `/onboarding` | signed-in | Held here until the CLI's first push lands |
| `/settings` | members | Alias, add-a-machine code; owners also let people in |
| `/login` | anyone | GitHub sign-in, default scopes |
| `/callback` | anyone | OAuth exchange, invite check, profile creation |
| `/cli?code=…` | signed-in | Confirms a device code shown in the terminal |
| `/robots.txt` | anyone | Disallows everything |

## API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/cli/enroll` | session cookie | Mints a single-use enrolment code for the onboarding command |
| `POST /api/auth/cli/redeem` | enrolment code | Exchanges it for a CLI token |
| `POST /api/auth/cli/init` | none | Issues a device code and poll secret (the type-it-in flow) |
| `POST /api/auth/cli/verify` | session cookie | Approves a code as the signed-in user |
| `POST /api/auth/cli/poll` | poll secret | Redeems an approved code for a CLI token |
| `POST /api/usage/submit` | CLI bearer | Upserts this device's rows for each day |
| `GET /api/usage/status` | CLI bearer | Streak, all three windows with ranks, device split |
| `POST /api/invites` | owner | Invites a GitHub username |
| `DELETE /api/invites` | owner | Revokes a pending invite |
| `POST /api/profile/listing` | member | Toggles your own leaderboard listing |
| `POST /api/profile/display-name` | member | Sets or clears your alias |
| `GET /api/onboarding/status` | signed-in | Polled while waiting for the first push |

Poll requires the secret as well as the code, so a code read aloud is not enough
to steal the token it will produce. Redemption is guarded on `redeemed_at`, so a
replayed poll is a no-op.

CLI tokens are HMAC-SHA256, 30 days, signed with `CLI_JWT_SECRET`. Tokens older
than 7 days come back refreshed in the `x-tokenmax-refreshed-token` header.

## Access

A row in `auth.users` is not membership; a row in `profiles` is. `/callback`
creates one only when the GitHub login is the configured owner (first sign-in
only) or sits in `invites`. Everyone else is signed out again and bounced to
`/login?denied=1`, so no stranger is left holding a usable cookie.

`lib/auth.ts` is the single gate. `requireMember()` redirects to `/login`, then
to `/onboarding` if `onboarded_at` is null; `requireAnyMember()` skips the second
hop so the onboarding page does not bounce to itself.

`requireMember()` redirects to `/login`;
`getMember()` returns null for API routes to turn into a 401. Pages read through
the service role, so the check in code is load-bearing — RLS is the second layer
underneath it, asserted in `supabase/tests/rls.sql`.

Per-device rows carry machine names and are never shown to anyone but their
owner, in the page and in the policy both.

## Look

`app/console.css` is the design study's stylesheet, copied verbatim from
`console.html` and not hand-edited — dark ground, one accent driven by `--hue`,
five clamp type steps, Archivo over Chivo Mono, one weight.

| File | Role |
|---|---|
| `lib/console/art.ts` | Canvas routines ported verbatim: starfield, member world, spend chart |
| `lib/console/board.ts` | Rank, class, streak, sparkline — over real rollups, not the study's mock |
| `lib/console/load.ts` | The two reads every screen shares |
| `lib/console/flight.ts` | The arrival, ported verbatim and kept behind one entry point |
| `app/console/` | Shell, rail, the live starfield, the lerped `--hue` |

Deviations from the study, each because the data is not there rather than as a
style choice:

- **Viewport paging** on the leaderboard is dropped; every member is shown.
- The class label's **"Heavy"** branch needs per-model token shares, which the
  daily rollup does not carry. The other branches are intact.
- The study routes with `<button>`; real URLs need `<a>`, so
  `app/console-overrides.css` carries the anchor reset and the avatar rules the
  study had no equivalent for. It is separate because `console.css` is
  re-extracted wholesale.

## Environment

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is used only in
route handlers and server components, never shipped to the browser.

## Tests

`bun test` — CLI token forgery rejection, GitHub login validation, streak
arithmetic.
