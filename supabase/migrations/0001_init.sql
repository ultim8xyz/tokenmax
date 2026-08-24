-- tokenmax schema
-- Source of truth is device_usage: one row per (user, date, device).
-- daily_usage is derived from it by trigger, so contributing from N machines
-- is a sum by construction and a re-push from one machine is a replace.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles

-- A profile row IS membership. Anyone can complete GitHub OAuth and end up in
-- auth.users; only an invited login gets a row here, and every read policy
-- below keys off that.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  github_login text unique,
  display_name text,
  avatar_url   text,
  role         text not null default 'member' check (role in ('owner', 'member')),
  -- Members-only either way. This only controls the shared leaderboard.
  is_listed    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Invited GitHub logins that have not signed in yet.
create table public.invites (
  github_login text primary key check (github_login = lower(github_login)),
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Used by every read policy. security definer so it can see profiles while
-- profiles' own policies are being evaluated.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- ---------------------------------------------------------------- devices

create table public.devices (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  device_id     uuid not null,
  name          text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- ------------------------------------------------------------ device_usage

create table public.device_usage (
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  usage_date              date not null,
  device_id               uuid not null,
  input_tokens            bigint not null default 0 check (input_tokens >= 0),
  output_tokens           bigint not null default 0 check (output_tokens >= 0),
  reasoning_output_tokens bigint not null default 0 check (reasoning_output_tokens >= 0),
  cache_creation_tokens   bigint not null default 0 check (cache_creation_tokens >= 0),
  cache_read_tokens       bigint not null default 0 check (cache_read_tokens >= 0),
  total_tokens            bigint not null default 0 check (total_tokens >= 0),
  cost_usd                numeric(14, 6) not null default 0 check (cost_usd >= 0),
  models                  text[] not null default '{}',
  agents                  text[] not null default '{}',
  -- Session shape, derived locally from transcripts. Counts only; no titles,
  -- no paths, no content.
  sessions                integer not null default 0 check (sessions >= 0),
  interactive_sessions    integer not null default 0 check (interactive_sessions >= 0),
  projects                integer not null default 0 check (projects >= 0),
  max_concurrent_sessions integer not null default 0 check (max_concurrent_sessions >= 0),
  first_activity_at       timestamptz,
  last_activity_at        timestamptz,
  max_gap_seconds         integer not null default 0 check (max_gap_seconds >= 0),
  model_breakdown         jsonb,
  collector               text,
  updated_at              timestamptz not null default now(),
  primary key (user_id, usage_date, device_id)
);

create index device_usage_user_date_idx on public.device_usage (user_id, usage_date desc);

-- ------------------------------------------------------------- daily_usage

create table public.daily_usage (
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  usage_date              date not null,
  input_tokens            bigint not null default 0,
  output_tokens           bigint not null default 0,
  reasoning_output_tokens bigint not null default 0,
  cache_creation_tokens   bigint not null default 0,
  cache_read_tokens       bigint not null default 0,
  total_tokens            bigint not null default 0,
  cost_usd                numeric(14, 6) not null default 0,
  models                  text[] not null default '{}',
  agents                  text[] not null default '{}',
  sessions                integer not null default 0,
  interactive_sessions    integer not null default 0,
  -- MAX across devices, not SUM: the same repo opened on two machines must not
  -- count twice, and de-duplicating would mean shipping path fingerprints.
  projects                integer not null default 0,
  max_concurrent_sessions integer not null default 0,
  first_activity_at       timestamptz,
  last_activity_at        timestamptz,
  max_gap_seconds         integer not null default 0,
  device_count            integer not null default 0,
  updated_at              timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create index daily_usage_date_idx on public.daily_usage (usage_date desc);

-- Recompute one (user, date) rollup from every device row that feeds it.
create or replace function public.refresh_daily_usage(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_usage where user_id = p_user_id and usage_date = p_date;

  insert into public.daily_usage (
    user_id, usage_date,
    input_tokens, output_tokens, reasoning_output_tokens,
    cache_creation_tokens, cache_read_tokens, total_tokens, cost_usd,
    models, agents,
    sessions, interactive_sessions, projects, max_concurrent_sessions,
    first_activity_at, last_activity_at, max_gap_seconds,
    device_count, updated_at
  )
  select
    p_user_id, p_date,
    sum(input_tokens), sum(output_tokens), sum(reasoning_output_tokens),
    sum(cache_creation_tokens), sum(cache_read_tokens), sum(total_tokens), sum(cost_usd),
    coalesce((select array_agg(distinct m order by m)
              from public.device_usage d2, unnest(d2.models) m
              where d2.user_id = p_user_id and d2.usage_date = p_date), '{}'),
    coalesce((select array_agg(distinct a order by a)
              from public.device_usage d3, unnest(d3.agents) a
              where d3.user_id = p_user_id and d3.usage_date = p_date), '{}'),
    sum(sessions), sum(interactive_sessions),
    max(projects), max(max_concurrent_sessions),
    min(first_activity_at), max(last_activity_at), max(max_gap_seconds),
    count(*), now()
  from public.device_usage d
  where d.user_id = p_user_id and d.usage_date = p_date
  having count(*) > 0;
end;
$$;

create or replace function public.device_usage_rollup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_daily_usage(old.user_id, old.usage_date);
    return old;
  end if;
  perform public.refresh_daily_usage(new.user_id, new.usage_date);
  return new;
end;
$$;

create trigger device_usage_rollup_trg
after insert or update or delete on public.device_usage
for each row execute function public.device_usage_rollup();

-- ---------------------------------------------------------- cli auth codes

create table public.cli_auth_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  poll_secret_hash text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'completed', 'used', 'expired')),
  user_id          uuid references public.profiles (id) on delete cascade,
  device_name      text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  redeemed_at      timestamptz
);

create index cli_auth_codes_expires_idx on public.cli_auth_codes (expires_at);

-- ------------------------------------------------------------------- views

-- One row per listed member with all three windows side by side, so the UI
-- switches window without a second query.
--
-- Windows are lower-bounded only. usage_date is the *device's* local day, so a
-- machine running ahead of UTC can legitimately report tomorrow's date; an
-- upper bound would drop it. This matches the submit route, which accepts one
-- day into the future for the same reason.
create or replace view public.leaderboard
with (security_invoker = true) as
select
  p.username,
  p.display_name,
  p.avatar_url,
  coalesce(sum(d.cost_usd)     filter (where d.usage_date >= current_date), 0)                     as cost_1d,
  coalesce(sum(d.total_tokens) filter (where d.usage_date >= current_date), 0)                     as tokens_1d,
  coalesce(sum(d.cost_usd)     filter (where d.usage_date > current_date - interval '7 days'), 0)  as cost_7d,
  coalesce(sum(d.total_tokens) filter (where d.usage_date > current_date - interval '7 days'), 0)  as tokens_7d,
  coalesce(sum(d.cost_usd), 0)     as cost_30d,
  coalesce(sum(d.total_tokens), 0) as tokens_30d,
  count(d.usage_date)              as active_days_30d
from public.profiles p
left join public.daily_usage d
  on d.user_id = p.id
 and d.usage_date > (current_date - interval '30 days')
where p.is_listed
group by p.id, p.username, p.display_name, p.avatar_url;

-- --------------------------------------------------------------------- rls

alter table public.profiles       enable row level security;
alter table public.invites        enable row level security;
alter table public.devices        enable row level security;
alter table public.device_usage   enable row level security;
alter table public.daily_usage    enable row level security;
alter table public.cli_auth_codes enable row level security;

-- Nothing here is readable by anon. Members see each other; that is the whole
-- audience.
create policy profiles_read on public.profiles
  for select using (id = (select auth.uid()) or public.is_member());
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Rollups follow the same membership rule, minus anyone who opted out of the
-- shared leaderboard.
create policy daily_usage_read on public.daily_usage
  for select using (
    user_id = (select auth.uid())
    or (public.is_member()
        and exists (select 1 from public.profiles p where p.id = user_id and p.is_listed))
  );

-- Invites are the owner's business; the API route reads them as service role.
-- No policy is defined on purpose.

-- Per-device rows carry machine names, so they stay private.
create policy device_usage_read_own on public.device_usage
  for select using (user_id = (select auth.uid()));
create policy devices_read_own on public.devices
  for select using (user_id = (select auth.uid()));

-- No policy on cli_auth_codes or invites: service role only.

-- Writes to usage tables are service-role only (the API routes), so no
-- insert/update policies are defined here on purpose.
