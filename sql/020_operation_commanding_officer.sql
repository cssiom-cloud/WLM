-- Commanding officer name for operation authorization / sign-off.
-- Run after 019_operations_and_aar.sql

alter table public.oc_operations
  add column if not exists commanding_officer text not null default '';
