-- One Discord/auth identity can own multiple personnel dossiers.
-- AuthUser = auth.users.id (owner_user_id).
-- ActivePersonnel = oc_auth_state.active_personnel_id (the selected character).

alter table public.oc_personnel
  add column if not exists owner_user_id uuid,
  add column if not exists discord_user_id text;

update public.oc_personnel
set owner_user_id = id
where owner_user_id is null;

alter table public.oc_personnel
  alter column owner_user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'oc_personnel_owner_user_id_fkey'
  ) then
    alter table public.oc_personnel
      add constraint oc_personnel_owner_user_id_fkey
      foreign key (owner_user_id) references auth.users (id) on delete cascade;
  end if;
end
$$;

alter table public.oc_personnel
  drop constraint if exists oc_personnel_id_fkey;

alter table public.oc_personnel
  drop constraint if exists oc_personnel_email_key;

create index if not exists oc_personnel_owner_idx on public.oc_personnel (owner_user_id);
create index if not exists oc_personnel_discord_idx on public.oc_personnel (discord_user_id);

create table if not exists public.oc_auth_state (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  active_personnel_id uuid not null references public.oc_personnel (id) on delete cascade,
  discord_user_id text,
  updated_at timestamptz not null default now()
);

alter table public.oc_auth_state enable row level security;

drop policy if exists oc_auth_state_self on public.oc_auth_state;
create policy oc_auth_state_self
  on public.oc_auth_state
  for all
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

grant select, insert, update, delete on public.oc_auth_state to authenticated;

insert into public.oc_auth_state (auth_user_id, active_personnel_id)
select p.owner_user_id, p.id
from public.oc_personnel p
where p.id = p.owner_user_id
on conflict (auth_user_id) do nothing;

create or replace function private.discord_id_for(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    ident.identity_data ->> 'provider_id',
    ident.identity_data ->> 'sub',
    ident.identity_data ->> 'id'
  )
  from auth.identities ident
  where ident.user_id = p_user_id
    and ident.provider = 'discord'
  limit 1;
$$;

create or replace function private.active_personnel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.active_personnel_id from public.oc_auth_state s where s.auth_user_id = auth.uid()),
    (select p.id from public.oc_personnel p where p.owner_user_id = auth.uid() order by p.id limit 1),
    auth.uid()
  );
$$;

create or replace function private.owns_personnel(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.oc_personnel
    where id = p_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function private.is_self_id(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_id is not null
    and (
      p_id = auth.uid()
      or p_id = private.active_personnel_id()
      or private.owns_personnel(p_id)
    );
$$;

revoke all on function private.discord_id_for(uuid) from public, anon;
revoke all on function private.active_personnel_id() from public, anon;
revoke all on function private.owns_personnel(uuid) from public, anon;
revoke all on function private.is_self_id(uuid) from public, anon;
grant execute on function private.active_personnel_id() to authenticated;
grant execute on function private.owns_personnel(uuid) to authenticated;
grant execute on function private.is_self_id(uuid) to authenticated;

create or replace function private.is_command_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.oc_personnel
    where id = private.active_personnel_id()
      and role = 'admin'
  );
$$;

create or replace function private.is_command_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.oc_personnel
    where id = private.active_personnel_id()
      and is_dev is true
  );
$$;

create or replace function private.is_unit_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.command_units
    where head_user_id = private.active_personnel_id()
  );
$$;

create or replace function private.is_unit_head(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.command_units
    where id = p_unit_id
      and head_user_id = private.active_personnel_id()
  );
$$;

create or replace function private.can_plan_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_command_admin()
    or exists (
      select 1
      from public.command_units
      where head_user_id = private.active_personnel_id()
    );
$$;

create or replace function private.can_edit_operation(p_operation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.is_command_admin()
    or exists (
      select 1
      from public.oc_operations o
      where o.id = p_operation_id
        and private.is_self_id(o.created_by)
    )
    or exists (
      select 1
      from public.oc_operation_sides s
      where s.operation_id = p_operation_id
        and private.can_manage_unit(s.unit_id)
    );
$$;

create or replace function private.handle_new_personnel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  discord_id text := private.discord_id_for(new.id);
begin
  insert into public.oc_personnel (id, owner_user_id, discord_user_id, email, role, military_rank)
  values (
    new.id,
    new.id,
    discord_id,
    coalesce(new.email, new.id::text || '@users.wlr.local'),
    'user',
    'Lieutenant'
  )
  on conflict (id) do update
    set owner_user_id = excluded.owner_user_id,
        discord_user_id = coalesce(public.oc_personnel.discord_user_id, excluded.discord_user_id);

  insert into public.oc_auth_state (auth_user_id, active_personnel_id, discord_user_id)
  values (new.id, new.id, discord_id)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

create or replace function private.sync_personnel_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.sync_personnel_email', 'on', true);
    update public.oc_personnel
    set email = new.email
    where owner_user_id = new.id;
  end if;
  return new;
end;
$$;

drop policy if exists oc_personnel_public_select on public.oc_personnel;
create policy oc_personnel_public_select
  on public.oc_personnel
  for select
  using (
    coalesce(is_dev, false) = false
    or owner_user_id = auth.uid()
    or private.is_command_dev()
  );

drop policy if exists oc_personnel_self_update on public.oc_personnel;
create policy oc_personnel_self_update
  on public.oc_personnel
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists oc_avatars_insert_own on storage.objects;
create policy oc_avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'oc_avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select id::text from public.oc_personnel where owner_user_id = auth.uid()
      )
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
      or (storage.foldername(name))[1] in (
        select id::text from public.oc_personnel where owner_user_id = auth.uid()
      )
      or private.is_command_admin()
    )
  )
  with check (
    bucket_id = 'oc_avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select id::text from public.oc_personnel where owner_user_id = auth.uid()
      )
      or private.is_command_admin()
    )
  );

drop policy if exists user_settings_self_insert on public.user_settings;
create policy user_settings_self_insert
  on public.user_settings for insert to authenticated
  with check (private.is_self_id(user_id));

drop policy if exists user_settings_self_update on public.user_settings;
create policy user_settings_self_update
  on public.user_settings for update to authenticated
  using (private.is_self_id(user_id))
  with check (private.is_self_id(user_id));

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select
  on public.activity_logs for select to authenticated
  using (private.is_self_id(user_id) or private.is_command_admin());

drop policy if exists activity_logs_insert_self on public.activity_logs;
create policy activity_logs_insert_self
  on public.activity_logs for insert to authenticated
  with check (private.is_self_id(user_id));

drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert
  on public.announcements for insert to authenticated
  with check (private.is_command_admin() and private.is_self_id(created_by));

drop policy if exists announcement_signups_self_insert on public.announcement_signups;
create policy announcement_signups_self_insert
  on public.announcement_signups for insert to authenticated
  with check (user_id = private.active_personnel_id());

drop policy if exists announcement_signups_self_delete on public.announcement_signups;
create policy announcement_signups_self_delete
  on public.announcement_signups for delete to authenticated
  using (user_id = private.active_personnel_id());

drop policy if exists command_unit_applications_select on public.command_unit_applications;
create policy command_unit_applications_select
  on public.command_unit_applications for select to authenticated
  using (private.is_self_id(user_id) or private.can_manage_unit(unit_id));

drop policy if exists command_unit_applications_self_insert on public.command_unit_applications;
create policy command_unit_applications_self_insert
  on public.command_unit_applications for insert to authenticated
  with check (user_id = private.active_personnel_id());

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select
  on public.support_tickets for select to authenticated
  using (private.is_self_id(user_id) or private.is_command_admin());

drop policy if exists support_tickets_self_insert on public.support_tickets;
create policy support_tickets_self_insert
  on public.support_tickets for insert to authenticated
  with check (private.is_self_id(user_id));

drop policy if exists oc_operations_planner_insert on public.oc_operations;
create policy oc_operations_planner_insert
  on public.oc_operations for insert to authenticated
  with check (private.can_plan_operations() and private.is_self_id(created_by));

drop policy if exists oc_operations_planner_delete on public.oc_operations;
create policy oc_operations_planner_delete
  on public.oc_operations for delete to authenticated
  using (private.is_command_admin() or private.is_self_id(created_by));

drop policy if exists oc_official_docs_insert on public.oc_official_docs;
create policy oc_official_docs_insert
  on public.oc_official_docs for insert to authenticated
  with check (private.is_self_id(created_by) and private.can_access_doc_folder(folder));

drop policy if exists oc_official_docs_update on public.oc_official_docs;
create policy oc_official_docs_update
  on public.oc_official_docs for update to authenticated
  using (
    private.can_access_doc_folder(folder)
    and (private.is_self_id(created_by) or private.is_command_admin() or private.is_command_dev())
  )
  with check (
    private.can_access_doc_folder(folder)
    and (private.is_self_id(created_by) or private.is_command_admin() or private.is_command_dev())
  );

drop policy if exists oc_official_docs_delete on public.oc_official_docs;
create policy oc_official_docs_delete
  on public.oc_official_docs for delete to authenticated
  using (
    private.can_access_doc_folder(folder)
    and (private.is_self_id(created_by) or private.is_command_admin() or private.is_command_dev())
  );

create or replace function public.apply_to_unit(p_unit_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count integer;
  capacity integer;
  application_id uuid;
  actor_id uuid := private.active_personnel_id();
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;
  if actor_id is null then
    raise exception 'Select a personnel profile first.';
  end if;

  select max_capacity into capacity from public.command_units where id = p_unit_id;
  if capacity is null then
    raise exception 'Unit was not found.';
  end if;

  if exists (select 1 from public.oc_personnel where id = actor_id and unit_id is not null) then
    raise exception 'You already belong to a unit.';
  end if;

  if exists (
    select 1 from public.command_unit_applications
    where user_id = actor_id and status = 'pending'
  ) then
    raise exception 'You already have a pending unit application.';
  end if;

  select count(*) into member_count from public.oc_personnel where unit_id = p_unit_id;
  if member_count >= capacity then
    raise exception 'Unit is at full capacity.';
  end if;

  insert into public.command_unit_applications (unit_id, user_id, status)
  values (p_unit_id, actor_id, 'pending')
  on conflict (unit_id, user_id) do update
    set status = 'pending',
        created_at = now(),
        reviewed_at = null,
        reviewed_by = null
  returning id into application_id;

  return application_id;
end;
$$;

create or replace function public.set_active_personnel(p_personnel_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  discord_id text := coalesce(private.discord_id_for(auth.uid()), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;
  if not private.owns_personnel(p_personnel_id) then
    raise exception 'That personnel file is not linked to this account.';
  end if;

  insert into public.oc_auth_state (auth_user_id, active_personnel_id, discord_user_id, updated_at)
  values (auth.uid(), p_personnel_id, nullif(discord_id, ''), now())
  on conflict (auth_user_id) do update
    set active_personnel_id = excluded.active_personnel_id,
        discord_user_id = coalesce(excluded.discord_user_id, public.oc_auth_state.discord_user_id),
        updated_at = now();

  if discord_id <> '' then
    update public.oc_personnel
    set discord_user_id = discord_id
    where owner_user_id = auth.uid()
      and coalesce(discord_user_id, '') is distinct from discord_id;
  end if;

  return p_personnel_id;
end;
$$;

create or replace function public.create_personnel_profile(p_first_name text default '', p_last_name text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  owner_email text;
  discord_id text := private.discord_id_for(auth.uid());
  profile_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;

  select count(*) into profile_count from public.oc_personnel where owner_user_id = auth.uid();
  if profile_count >= 8 then
    raise exception 'This account already has the maximum number of personnel files.';
  end if;

  select email into owner_email from auth.users where id = auth.uid();

  insert into public.oc_personnel (
    id, owner_user_id, discord_user_id, email, role, military_rank, first_name, last_name
  ) values (
    new_id,
    auth.uid(),
    discord_id,
    coalesce(owner_email, auth.uid()::text || '@users.wlr.local'),
    'user',
    'Lieutenant',
    nullif(btrim(p_first_name), ''),
    nullif(btrim(p_last_name), '')
  );

  perform public.set_active_personnel(new_id);
  return new_id;
end;
$$;

create or replace function public.delete_personnel_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner uuid;
begin
  if not private.is_command_admin() then
    raise exception 'Only command administrators can delete personnel.';
  end if;
  if p_user_id = auth.uid() or p_user_id = private.active_personnel_id() then
    raise exception 'You cannot delete the personnel file you are using.';
  end if;
  if exists (select 1 from public.oc_personnel where id = p_user_id and role = 'admin')
     and (select count(*) from public.oc_personnel where role = 'admin') <= 1 then
    raise exception 'The last administrator cannot be deleted.';
  end if;

  select owner_user_id into v_owner from public.oc_personnel where id = p_user_id;
  if v_owner is null then
    raise exception 'Personnel was not found.';
  end if;

  insert into public.activity_logs (user_id, role_snapshot, action_type, details)
  values (private.active_personnel_id(), 'admin', 'personnel_delete', concat('Deleted personnel record ', p_user_id::text));

  delete from public.oc_personnel where id = p_user_id;

  if not exists (select 1 from public.oc_personnel where owner_user_id = v_owner) then
    delete from auth.users where id = v_owner;
  end if;
end;
$$;

revoke all on function public.set_active_personnel(uuid) from public, anon;
revoke all on function public.create_personnel_profile(text, text) from public, anon;
grant execute on function public.set_active_personnel(uuid) to authenticated;
grant execute on function public.create_personnel_profile(text, text) to authenticated;
grant execute on function public.apply_to_unit(uuid) to authenticated;
grant execute on function public.delete_personnel_account(uuid) to authenticated;
