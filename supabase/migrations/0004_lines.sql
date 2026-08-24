-- Lines of code, from git rather than from transcripts.
--
-- Counted from commits that carry a Claude co-author trailer and were authored
-- by one of this machine's identities. Shell edits are invisible to the
-- transcripts, which is why this comes from git.

alter table public.device_usage
  add column if not exists lines_added   integer not null default 0 check (lines_added >= 0),
  add column if not exists lines_removed integer not null default 0 check (lines_removed >= 0),
  add column if not exists commits       integer not null default 0 check (commits >= 0);

alter table public.daily_usage
  add column if not exists lines_added   integer not null default 0,
  add column if not exists lines_removed integer not null default 0,
  add column if not exists commits       integer not null default 0;

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
    lines_added, lines_removed, commits,
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
    -- Commits are per-repo and per-machine, so they add up across devices.
    sum(lines_added), sum(lines_removed), sum(commits),
    count(*), now()
  from public.device_usage d
  where d.user_id = p_user_id and d.usage_date = p_date
  having count(*) > 0;
end;
$$;
