-- Hidden Dev status (independent of military rank / app role)
-- and the official memorandum document center.

alter table public.oc_personnel
  add column if not exists is_dev boolean not null default false;

create index if not exists oc_personnel_is_dev_idx on public.oc_personnel (is_dev);

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
    where id = auth.uid()
      and is_dev is true
  );
$$;

revoke all on function private.is_command_dev() from public, anon;
grant execute on function private.is_command_dev() to authenticated;

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
    where head_user_id = auth.uid()
  );
$$;

revoke all on function private.is_unit_leader() from public, anon;
grant execute on function private.is_unit_leader() to authenticated;

-- Devs are invisible in personnel reads except to themselves and other Devs.
drop policy if exists oc_personnel_public_select on public.oc_personnel;
create policy oc_personnel_public_select
  on public.oc_personnel
  for select
  using (
    coalesce(is_dev, false) = false
    or id = auth.uid()
    or private.is_command_dev()
  );

create or replace function private.enforce_personnel_column_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Personnel identifier cannot be changed.';
  end if;

  if new.email is distinct from old.email
     and current_setting('app.sync_personnel_email', true) is distinct from 'on' then
    raise exception 'Email must be changed through Auth.';
  end if;

  if new.is_dev is distinct from old.is_dev then
    if auth.uid() is not null and not private.is_command_dev() then
      raise exception 'is_dev is restricted.';
    end if;
  end if;

  if auth.uid() is not null and not private.is_command_admin() then
    if new.military_rank is distinct from old.military_rank then
      raise exception 'military_rank is restricted.';
    end if;
    if new.role is distinct from old.role then
      raise exception 'role is restricted.';
    end if;
    if new.honor_ranks is distinct from old.honor_ranks then
      raise exception 'honor_ranks is restricted.';
    end if;
    if new.medals is distinct from old.medals then
      raise exception 'medals is restricted.';
    end if;
    if new.completed_missions is distinct from old.completed_missions then
      raise exception 'completed_missions is restricted.';
    end if;
    if new.service_skills is distinct from old.service_skills then
      raise exception 'service_skills is restricted.';
    end if;
    if new.service_timeline is distinct from old.service_timeline then
      raise exception 'service_timeline is restricted.';
    end if;
    if new.nationality is distinct from old.nationality then
      raise exception 'nationality is restricted.';
    end if;
    if new.race is distinct from old.race then
      raise exception 'race is restricted.';
    end if;
    if new.religion is distinct from old.religion then
      raise exception 'religion is restricted.';
    end if;
    if new.training_course is distinct from old.training_course then
      raise exception 'training_course is restricted.';
    end if;
    if new.military_branch is distinct from old.military_branch then
      raise exception 'military_branch is restricted.';
    end if;
    if new.organization_role is distinct from old.organization_role then
      raise exception 'organization_role is restricted.';
    end if;
    if new.wlc_agency is distinct from old.wlc_agency
       or new.unit_id is distinct from old.unit_id
       or new.unit_rank_id is distinct from old.unit_rank_id then
      if not (
        private.can_manage_unit(old.unit_id)
        or private.can_manage_unit(new.unit_id)
      ) then
        raise exception 'unit assignment is restricted.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.can_access_doc_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_folder
    when 'normal' then auth.uid() is not null
    when 'unit_leader' then
      private.is_command_admin()
      or private.is_unit_leader()
      or private.is_command_dev()
    when 'admin' then private.is_command_admin() or private.is_command_dev()
    when 'dev' then private.is_command_dev()
    else false
  end;
$$;

revoke all on function private.can_access_doc_folder(text) from public, anon;
grant execute on function private.can_access_doc_folder(text) to authenticated;

create table if not exists public.oc_official_docs (
  id uuid primary key default gen_random_uuid(),
  folder text not null default 'normal'
    check (folder in ('normal', 'unit_leader', 'admin', 'dev')),
  doc_no text not null default '',
  doc_date text not null default '',
  subject text not null default '',
  addressed_to text not null default '',
  body text not null default '',
  sign_name text not null default '',
  sign_title text not null default '',
  logo_url text,
  created_by uuid references public.oc_personnel (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oc_official_docs_folder_idx on public.oc_official_docs (folder, updated_at desc);

create or replace function private.touch_oc_official_docs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists oc_official_docs_touch on public.oc_official_docs;
create trigger oc_official_docs_touch
  before update on public.oc_official_docs
  for each row execute procedure private.touch_oc_official_docs();

alter table public.oc_official_docs enable row level security;

drop policy if exists oc_official_docs_select on public.oc_official_docs;
create policy oc_official_docs_select
  on public.oc_official_docs
  for select
  to authenticated
  using (private.can_access_doc_folder(folder));

drop policy if exists oc_official_docs_insert on public.oc_official_docs;
create policy oc_official_docs_insert
  on public.oc_official_docs
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and private.can_access_doc_folder(folder)
  );

drop policy if exists oc_official_docs_update on public.oc_official_docs;
create policy oc_official_docs_update
  on public.oc_official_docs
  for update
  to authenticated
  using (
    private.can_access_doc_folder(folder)
    and (created_by = auth.uid() or private.is_command_admin() or private.is_command_dev())
  )
  with check (
    private.can_access_doc_folder(folder)
    and (created_by = auth.uid() or private.is_command_admin() or private.is_command_dev())
  );

drop policy if exists oc_official_docs_delete on public.oc_official_docs;
create policy oc_official_docs_delete
  on public.oc_official_docs
  for delete
  to authenticated
  using (
    private.can_access_doc_folder(folder)
    and (created_by = auth.uid() or private.is_command_admin() or private.is_command_dev())
  );

grant select, insert, update, delete on public.oc_official_docs to authenticated;
