-- Announcement cover images: column + public storage bucket managed by admins.
-- Run after 006_announcements.sql

alter table public.announcements
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('announcement_covers', 'announcement_covers', true)
on conflict (id) do update
set public = true;

drop policy if exists announcement_covers_public_select on storage.objects;
create policy announcement_covers_public_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'announcement_covers');

drop policy if exists announcement_covers_admin_insert on storage.objects;
create policy announcement_covers_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'announcement_covers'
    and private.is_command_admin()
  );

drop policy if exists announcement_covers_admin_update on storage.objects;
create policy announcement_covers_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'announcement_covers'
    and private.is_command_admin()
  )
  with check (
    bucket_id = 'announcement_covers'
    and private.is_command_admin()
  );

drop policy if exists announcement_covers_admin_delete on storage.objects;
create policy announcement_covers_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'announcement_covers'
    and private.is_command_admin()
  );
