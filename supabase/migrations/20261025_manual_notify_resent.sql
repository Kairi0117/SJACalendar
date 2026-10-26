-- Manual notifications can be re-sent on demand
-- Date: 2026-10-25
--
-- The (event_id, parent_id, type) dedupe exists so the automated reminder cron
-- cannot email the same parent twice about the same event. A manual send is an
-- explicit admin action, so it was wrongly being swallowed by that dedupe:
-- the second click on Notify reported "no parents matched" even though the
-- dialog had just shown a matching parent count.
--
-- Scope the unique index to everything except 'manual', so the cron keeps its
-- protection while a manual send always goes out and each one is logged.

alter table public.notification_logs
  drop constraint if exists notification_logs_event_id_parent_id_type_key;

create unique index if not exists notification_logs_dedupe_idx
  on public.notification_logs (event_id, parent_id, type)
  where type <> 'manual';
