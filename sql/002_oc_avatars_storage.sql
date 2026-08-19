-- W.L.R Avatar Storage
-- Run after 001_oc_personnel_schema.sql

insert into storage.buckets (id, name, public)
values ('oc_avatars', 'oc_avatars', true)
on conflict (id) do update
set public = true;

drop policy if exists oc_avatars_public_select on storage.objects;
create policy oc_avatars_public_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'oc_avatars');

drop policy if exists oc_avatars_insert_own on storage.objects;
create policy oc_avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'oc_avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists oc_avatars_update_own on storage.objects;
create policy oc_avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'oc_avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'oc_avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
