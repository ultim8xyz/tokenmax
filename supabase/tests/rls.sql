-- Access contract. Run against a database with 0001_init.sql applied:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- Asserts that a stranger sees nothing, that finishing GitHub OAuth without an
-- invite is not membership, and that per-device rows never leave the owner.
-- Raises on the first disagreement; no output means the contract holds.

begin;

\set owner_id   'aaaaaaaa-0000-0000-0000-000000000001'
\set friend_id  'aaaaaaaa-0000-0000-0000-000000000002'
\set hidden_id  'aaaaaaaa-0000-0000-0000-000000000003'
\set random_id  'aaaaaaaa-0000-0000-0000-000000000004'
\set device     'bbbbbbbb-0000-0000-0000-000000000001'

insert into auth.users (id) values (:'owner_id'), (:'friend_id'), (:'hidden_id'), (:'random_id');

insert into public.profiles (id, username, github_login, role, is_listed) values
  (:'owner_id',  'owner',  'owner-login',  'owner',  true),
  (:'friend_id', 'friend', 'friend-login', 'member', true),
  (:'hidden_id', 'hidden', 'hidden-login', 'member', false);
-- :random_id deliberately gets no profile: OAuth completed, never invited.

insert into public.device_usage (user_id, usage_date, device_id, total_tokens, cost_usd)
values
  (:'friend_id', '2026-08-23', :'device', 100, 10),
  (:'hidden_id', '2026-08-23', :'device', 100, 10);

insert into public.invites (github_login, invited_by) values ('pending-friend', :'owner_id');

create or replace function pg_temp.expect(label text, actual bigint, wanted bigint)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '% — expected % row(s), got %', label, wanted, actual;
  end if;
end;
$$;

-- ------------------------------------------------------------------- anon --

set local role anon;
set local request.jwt.claim.sub = '';

select pg_temp.expect('anon reads no profiles',      (select count(*) from public.profiles), 0);
select pg_temp.expect('anon reads no rollups',       (select count(*) from public.daily_usage), 0);
select pg_temp.expect('anon reads no device rows',   (select count(*) from public.device_usage), 0);
select pg_temp.expect('anon reads no devices',       (select count(*) from public.devices), 0);
select pg_temp.expect('anon reads no invites',       (select count(*) from public.invites), 0);
select pg_temp.expect('anon reads no auth codes',    (select count(*) from public.cli_auth_codes), 0);
select pg_temp.expect('anon sees an empty board',    (select count(*) from public.leaderboard), 0);

-- ------------------------- signed in with GitHub, but never invited --------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000004';

select pg_temp.expect('uninvited reads no profiles', (select count(*) from public.profiles), 0);
select pg_temp.expect('uninvited reads no rollups',  (select count(*) from public.daily_usage), 0);
select pg_temp.expect('uninvited sees no board',     (select count(*) from public.leaderboard), 0);
select pg_temp.expect('uninvited reads no invites',  (select count(*) from public.invites), 0);

-- ----------------------------------------------------------------- member --

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

select pg_temp.expect('member sees every member',    (select count(*) from public.profiles), 3);
-- The hidden member's rollup is not visible; the listed one's is.
select pg_temp.expect('member sees listed rollups',  (select count(*) from public.daily_usage), 1);
select pg_temp.expect('member sees listed board',    (select count(*) from public.leaderboard), 2);
select pg_temp.expect('member reads no foreign devices',
                      (select count(*) from public.device_usage), 0);
select pg_temp.expect('member reads no invites',     (select count(*) from public.invites), 0);

-- --------------------------------------------- a hidden member sees itself --

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';

select pg_temp.expect('hidden member sees own rollup',
                      (select count(*) from public.daily_usage where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 1);
select pg_temp.expect('hidden member sees own device rows',
                      (select count(*) from public.device_usage), 1);
select pg_temp.expect('hidden member is off the board',
                      (select count(*) from public.leaderboard where username = 'hidden'), 0);

reset role;
rollback;
