-- Unit crest image and optional click-through link. Heads and admins may upload.

alter table public.command_units
  add column if not exists logo_url text;

alter table public.command_units
  add column if not exists logo_link text;

insert into storage.buckets (id, name, public)
values ('unit_logos', 'unit_logos', true)
on conflict (id) do update
set public = true;

drop policy if exists unit_logos_public_select on storage.objects;
create policy unit_logos_public_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'unit_logos');

drop policy if exists unit_logos_manage_insert on storage.objects;
create policy unit_logos_manage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'unit_logos'
    and private.can_manage_unit(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists unit_logos_manage_update on storage.objects;
create policy unit_logos_manage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'unit_logos'
    and private.can_manage_unit(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'unit_logos'
    and private.can_manage_unit(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists unit_logos_manage_delete on storage.objects;
create policy unit_logos_manage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'unit_logos'
    and private.can_manage_unit(((storage.foldername(name))[1])::uuid)
  );
