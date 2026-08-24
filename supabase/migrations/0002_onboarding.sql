-- Onboarding gate and display names.
--
-- A profile row is membership; onboarded_at is proof the CLI actually reached
-- the instance. Until it is set, the member sees only the onboarding page and
-- is absent from the leaderboard — an account with no sync is not a competitor.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- display_name is now an optional alias, not GitHub's full name. Null means
-- "show the GitHub username", which is what every surface already falls back to.
comment on column public.profiles.display_name is
  'Optional alias shown instead of username. Null means use username.';

-- Existing members predate the gate, so they are onboarded by definition;
-- there is exactly one and it is the owner.
update public.profiles set onboarded_at = now() where onboarded_at is null;

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
  and p.onboarded_at is not null
group by p.id, p.username, p.display_name, p.avatar_url;
