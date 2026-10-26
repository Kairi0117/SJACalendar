-- Add soft-delete (archive) support to students
alter table students add column if not exists archived boolean not null default false;
alter table students add column if not exists archived_at timestamptz;
create index if not exists students_archived_idx on students (archived);
