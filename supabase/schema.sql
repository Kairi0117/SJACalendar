-- School Digital Calendar - Database Schema (Supabase / PostgreSQL)
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_number text,
  full_name text not null,
  grade_level text not null,
  code_hash text not null,
  code_created_at timestamptz not null default now(),
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists students_number_unique on students (student_number) where student_number is not null;

-- Parents
create table if not exists parents (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  middle_name text,
  last_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Parent <-> Student links
create table if not exists parent_students (
  parent_id uuid not null references parents(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (parent_id, student_id)
);

-- Events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  all_grades boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Event <-> Grade levels
create table if not exists event_grades (
  event_id uuid not null references events(id) on delete cascade,
  grade_level text not null,
  primary key (event_id, grade_level)
);

-- Admins
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- Email verification codes
create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ev_email_created on email_verifications (email, created_at desc);

-- Login attempts (rate limiting)
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  attempt_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists la_identifier on login_attempts (identifier);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  parent_id uuid references parents(id) on delete cascade,
  admin_id uuid references admins(id) on delete cascade,
  role text not null check (role in ('parent','admin')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Notification log
create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  type text not null check (type in ('posted','manual','1_month','1_week','3_days')),
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  unique (event_id, parent_id, type)
);

-- Forgotten code requests
create table if not exists code_requests (
  id uuid primary key default gen_random_uuid(),
  parent_email text not null,
  student_id uuid references students(id) on delete set null,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now()
);

-- Row Level Security
--
-- Every table is locked down and no policies are granted, so the anon and
-- authenticated roles can read nothing. This matters: the app never uses the
-- anon key (all access goes through the service role, which bypasses RLS), so
-- RLS costs nothing functionally and means a leaked anon key exposes no data.
--
-- Without this, a fresh project built from this file would let anyone with the
-- anon key read parents, students (including code_hash) and admins
-- (including password_hash).
alter table students enable row level security;
alter table parents enable row level security;
alter table parent_students enable row level security;
alter table events enable row level security;
alter table event_grades enable row level security;
alter table admins enable row level security;
alter table email_verifications enable row level security;
alter table login_attempts enable row level security;
alter table sessions enable row level security;
alter table notification_logs enable row level security;
alter table code_requests enable row level security;
