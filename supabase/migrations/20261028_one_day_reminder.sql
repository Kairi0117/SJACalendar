-- Add 1-day-before reminder type
-- Date: 2026-10-28
--
-- Extends the automated reminder schedule to include a final reminder sent
-- 1 day before an event. Mirrors the existing 3-day reminder handling.

alter table public.notification_logs drop constraint if exists notification_logs_type_check;

alter table public.notification_logs
  add constraint notification_logs_type_check
  check (type in ('posted', 'manual', '1_month', '1_week', '3_days', '1_day'));