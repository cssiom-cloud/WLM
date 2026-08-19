-- Service records: completed missions and earned medals per personnel.
-- Run after 007_announcement_covers.sql
-- training_course already exists on oc_personnel.

alter table public.oc_personnel
  add column if not exists completed_missions text[] not null default '{}';

alter table public.oc_personnel
  add column if not exists medals text[] not null default '{}';
