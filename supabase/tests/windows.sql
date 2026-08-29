-- Leaderboard window boundaries. Run against a database with 0001_init.sql
-- applied:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/windows.sql
--
-- Each day below contributes $1, so every expected total doubles as a count of
-- which days the window let in. Rolls back when it finishes.
--
-- Safe against a database with real members in it: every assertion is scoped to
-- this fixture's own row, so a real member on the board cannot change a count.

begin;

\set uid    'cccccccc-0000-0000-0000-000000000001'
\set device 'dddddddd-0000-0000-0000-000000000001'

insert into auth.users (id) values (:'uid');
-- onboarded_at is required: 0002 added it to the leaderboard's WHERE, and a
-- fixture without it is absent from the view entirely.
insert into public.profiles (id, username, role, onboarded_at)
values (:'uid', 'windows-test', 'member', now());

create or replace function pg_temp.expect(label text, actual numeric, wanted numeric)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '% — expected %, got %', label, wanted, actual;
  end if;
end;
$$;

-- One dollar on each of: tomorrow, today, and 1/6/7/29/30 days back.
insert into public.device_usage (user_id, usage_date, device_id, total_tokens, cost_usd)
select :'uid', current_date + offset_days, :'device', 1, 1
from unnest(array[1, 0, -1, -6, -7, -29, -30]) as offset_days;

-- Scoping every assertion to this row means its absence would pass them all by
-- returning no rows at all. Assert it is there first.
select pg_temp.expect('fixture reaches the board',
  (select count(*) from public.leaderboard where username = 'windows-test'), 1);

-- A device ahead of UTC reports tomorrow's date; every window must keep it.
select pg_temp.expect('today = tomorrow + today',        cost_1d,  2)
from public.leaderboard where username = 'windows-test';
select pg_temp.expect('7d spans today-6 .. tomorrow',    cost_7d,  4)
from public.leaderboard where username = 'windows-test';
select pg_temp.expect('30d spans today-29 .. tomorrow',  cost_30d, 6)
from public.leaderboard where username = 'windows-test';

-- The excluded days are the boundary itself, not one inside it.
select pg_temp.expect('day -7 is outside 7d',
  (select count(*) from public.daily_usage
   where user_id = :'uid' and usage_date = current_date - 7), 1);
select pg_temp.expect('day -30 is outside 30d',
  (select count(*) from public.daily_usage
   where user_id = :'uid' and usage_date = current_date - 30), 1);

-- active_days_30d counts days, not rows.
select pg_temp.expect('active days in 30d', active_days_30d, 6)
from public.leaderboard where username = 'windows-test';

-- An unlisted member is absent from every window.
update public.profiles set is_listed = false where id = :'uid';
select pg_temp.expect('unlisted is off the board',
  (select count(*) from public.leaderboard where username = 'windows-test'), 0);

rollback;
