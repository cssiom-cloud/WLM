-- Dossier cover image + allow command admins to upload avatars for any personnel.

alter table public.oc_personnel
  add column if not exists cover_url text;

drop policy if exists oc_avatars_insert_own on storage.objects;
create policy oc_avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'oc_avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or private.is_command_admin()
    )
  );

drop policy if exists oc_avatars_update_own on storage.objects;
create policy oc_avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'oc_avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or private.is_command_admin()
    )
  )
  with check (
    bucket_id = 'oc_avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or private.is_command_admin()
    )
  );
