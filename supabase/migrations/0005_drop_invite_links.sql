-- Drops invite links.
--
-- 0003 added a link that admitted whoever held it. Signup opened before
-- anything was ever wired to it, so the table and its function were reachable
-- only from a migration file: no route handler called `redeem_invite_link`, and
-- both were still empty when this ran.
--
-- The `invites` allowlist from 0001 stays. That one is not dead code — it is
-- what `TOKENMAX_OPEN_SIGNUP=0` falls back to, and dropping it would remove the
-- only way to shut the door again.

drop function if exists public.redeem_invite_link(text, uuid);
drop table if exists public.invite_links;
