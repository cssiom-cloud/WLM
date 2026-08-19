-- Promote the first command administrator after that account has signed up.
-- Replace the email address before running.
-- Run this in the SQL Editor after 011_bootstrap_admin_guard.sql.

update public.oc_personnel
set role = 'admin'
where email = 'replace-with-admin@example.com';
