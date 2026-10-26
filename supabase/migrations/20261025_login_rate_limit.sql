-- Login rate limiting: atomic bookkeeping
-- Date: 2026-10-25
--
-- Why: the previous implementation read the attempt count and then wrote it back
-- in two separate statements. Two concurrent failed logins could both read
-- attempt_count = 0 and both write 1, so the counter undercounted and the
-- lockout never engaged. These functions do the increment in a single
-- statement, which Postgres serialises with a row lock.
--
-- Also fixes: once a lockout expired, the stale attempt_count was reused, so
-- the first failed attempt after expiry immediately re-locked the account
-- instead of starting a fresh window.
--
-- Called from the app with supabaseAdmin.rpc(...). Only the service role can
-- execute them, so the anon key cannot be used to lock accounts out.

create or replace function public.record_login_attempt(
  p_identifier text,
  p_max_attempts int default 3
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts (identifier, attempt_count, locked_until, updated_at)
  values (p_identifier, 1, null, now())
  on conflict (identifier) do update
    set attempt_count = case
          -- Previous lockout expired: start a fresh window.
          when public.login_attempts.locked_until is not null
               and public.login_attempts.locked_until <= now()
            then 1
          else public.login_attempts.attempt_count + 1
        end,
        locked_until = case
          when public.login_attempts.locked_until is not null
               and public.login_attempts.locked_until <= now()
            then null
          when public.login_attempts.attempt_count + 1 >= p_max_attempts
            then now() + interval '10 minutes'
          else null
        end,
        updated_at = now();
end;
$$;

create or replace function public.clear_login_attempts(p_identifier text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where identifier = p_identifier;
$$;

-- These functions run as their owner and write to a table that has RLS enabled
-- with no policies, so they must not be reachable by the anon/authenticated
-- roles. Default EXECUTE is granted to PUBLIC, so revoke it explicitly.
revoke all on function public.record_login_attempt(text, int) from public, anon, authenticated;
revoke all on function public.clear_login_attempts(text) from public, anon, authenticated;

grant execute on function public.record_login_attempt(text, int) to service_role;
grant execute on function public.clear_login_attempts(text) to service_role;
