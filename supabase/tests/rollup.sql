-- Multi-device rollup contract. Run against a database that already has
-- 0001_init.sql applied:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rollup.sql
--
-- Every assertion below raises if daily_usage disagrees with the device rows
-- that feed it. No output means the contract holds.

begin;

\set uid    '99999999-9999-9999-9999-999999999999'
\set laptop '11111111-1111-1111-1111-111111111111'
\set desk   '22222222-2222-2222-2222-222222222222'
\set day    '2026-08-23'

insert into auth.users (id) values (:'uid') on conflict do nothing;
insert into public.profiles (id, username) values (:'uid', 'rollup-test');

create or replace function pg_temp.expect(label text, actual numeric, wanted numeric)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '% — expected %, got %', label, wanted, actual;
  end if;
end;
$$;

create or replace function pg_temp.push(device uuid, cost numeric, toks bigint, model text)
returns void language sql as $$
  insert into public.device_usage
    (user_id, usage_date, device_id, total_tokens, cost_usd, models)
  values
    ('99999999-9999-9999-9999-999999999999', '2026-08-23', device, toks, cost, array[model])
  on conflict (user_id, usage_date, device_id) do update
    set total_tokens = excluded.total_tokens,
        cost_usd     = excluded.cost_usd,
        models       = excluded.models;
$$;

create or replace function pg_temp.push_sessions(
  device uuid, sess int, proj int, peak int, first_at timestamptz, last_at timestamptz, gap int)
returns void language sql as $$
  insert into public.device_usage
    (user_id, usage_date, device_id, sessions, interactive_sessions, projects,
     max_concurrent_sessions, first_activity_at, last_activity_at, max_gap_seconds)
  values
    ('99999999-9999-9999-9999-999999999999', '2026-08-23', device, sess, sess, proj,
     peak, first_at, last_at, gap)
  on conflict (user_id, usage_date, device_id) do update
    set sessions                = excluded.sessions,
        interactive_sessions    = excluded.interactive_sessions,
        projects                = excluded.projects,
        max_concurrent_sessions = excluded.max_concurrent_sessions,
        first_activity_at       = excluded.first_activity_at,
        last_activity_at        = excluded.last_activity_at,
        max_gap_seconds         = excluded.max_gap_seconds;
$$;

-- One device.
select pg_temp.push(:'laptop', 10, 100, 'claude-opus-5');
select pg_temp.expect('single device cost', cost_usd, 10),
       pg_temp.expect('single device count', device_count, 1)
from public.daily_usage where user_id = :'uid' and usage_date = :'day';

-- A second device on the same day sums rather than replaces.
select pg_temp.push(:'desk', 5, 50, 'claude-sonnet-5');
select pg_temp.expect('two devices sum cost', cost_usd, 15),
       pg_temp.expect('two devices sum tokens', total_tokens, 150),
       pg_temp.expect('two devices counted', device_count, 2)
from public.daily_usage where user_id = :'uid' and usage_date = :'day';

-- The same device re-pushing replaces only its own row.
select pg_temp.push(:'laptop', 12, 120, 'claude-opus-5');
select pg_temp.expect('re-push replaces', cost_usd, 17),
       pg_temp.expect('re-push keeps device count', device_count, 2)
from public.daily_usage where user_id = :'uid' and usage_date = :'day';

-- Removing a device removes only its contribution.
delete from public.device_usage where user_id = :'uid' and device_id = :'desk';
select pg_temp.expect('delete one device', cost_usd, 12),
       pg_temp.expect('delete drops the count', device_count, 1)
from public.daily_usage where user_id = :'uid' and usage_date = :'day';

-- Session shape aggregates differently per column: sessions add up, but a
-- project or a peak is a day-level maximum that would be nonsense summed.
select pg_temp.push_sessions(:'laptop', 4, 3, 6, '2026-08-23T09:00Z', '2026-08-23T17:00Z', 3600);
select pg_temp.push_sessions(:'desk',   6, 5, 2, '2026-08-23T07:00Z', '2026-08-23T21:00Z', 7200);

select pg_temp.expect('sessions sum across devices',   sessions, 10),
       pg_temp.expect('interactive sessions sum',      interactive_sessions, 10),
       pg_temp.expect('projects take the max',         projects, 5),
       pg_temp.expect('peak concurrency takes the max', max_concurrent_sessions, 6),
       pg_temp.expect('widest quiet stretch wins',     max_gap_seconds, 7200)
from public.daily_usage where user_id = :'uid' and usage_date = :'day';

select pg_temp.expect('activity starts at the earliest device',
  extract(hour from (select first_activity_at at time zone 'UTC'
                     from public.daily_usage where user_id = :'uid' and usage_date = :'day'))::numeric, 7);
select pg_temp.expect('activity ends at the latest device',
  extract(hour from (select last_activity_at at time zone 'UTC'
                     from public.daily_usage where user_id = :'uid' and usage_date = :'day'))::numeric, 21);

-- Removing the last device removes the rollup entirely.
delete from public.device_usage where user_id = :'uid';
select pg_temp.expect(
  'empty day has no rollup',
  (select count(*) from public.daily_usage where user_id = :'uid'),
  0
);

rollback;
