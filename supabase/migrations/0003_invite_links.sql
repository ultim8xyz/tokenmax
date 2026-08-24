-- Invite links.
--
-- A link that admits whoever holds it, so letting a friend in is sending them a
-- URL rather than asking for their GitHub username. The link *is* the
-- credential, so only its digest is stored and it carries a use count and an
-- expiry.

create table if not exists public.invite_links (
  id         uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  label      text,
  created_by uuid references public.profiles (id) on delete set null,
  max_uses   integer not null default 1 check (max_uses between 1 and 100),
  uses       integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invite_links_expires_idx on public.invite_links (expires_at);

alter table public.invite_links enable row level security;
-- No policy: service role only. A link is redeemed through a route handler, and
-- nothing about it should be readable by a client.

/* Redeems a link for a user in one statement.
 *
 * The count is incremented in the same UPDATE that checks it, so two people
 * opening the last use of a link at the same moment cannot both get in. */
create or replace function public.redeem_invite_link(p_token_hash text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  update public.invite_links
     set uses = uses + 1
   where token_hash = p_token_hash
     and revoked_at is null
     and expires_at > now()
     and uses < max_uses
  returning id into claimed;

  if claimed is null then
    return false;
  end if;

  insert into public.profiles (id, username, github_login, role)
  select p_user_id,
         coalesce(nullif(regexp_replace(lower(u.raw_user_meta_data->>'user_name'),
                                        '[^a-z0-9-]', '-', 'g'), ''), 'builder'),
         lower(u.raw_user_meta_data->>'user_name'),
         'member'
    from auth.users u
   where u.id = p_user_id
  on conflict (id) do nothing;

  return true;
end;
$$;
