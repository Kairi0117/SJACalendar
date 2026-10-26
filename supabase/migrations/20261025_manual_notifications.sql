-- Manual per-event notifications
-- Date: 2026-10-25
--
-- Admins can re-send an event to parents on demand from the events list.
-- Those sends are logged as type 'manual' so they stay distinct from the
-- automatic 'posted' email that fires when an event is created, and so a
-- manual send is not swallowed by the (event_id, parent_id, type) dedupe.

alter table public.notification_logs drop constraint if exists notification_logs_type_check;

alter table public.notification_logs
  add constraint notification_logs_type_check
  check (type in ('posted', 'manual', '1_month', '1_week', '3_days'));
