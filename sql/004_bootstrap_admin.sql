-- Promote the first command administrator after that account has signed up.
-- Replace the email address before running.

update public.oc_personnel
set role = 'admin'
where email = 'replace-with-admin@example.com';
