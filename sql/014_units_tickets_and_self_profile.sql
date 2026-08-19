-- Units, applications, support tickets, self-serve age/gender, and admin account deletion.
-- Run after 013_lock_signups_after_close.sql

alter table public.oc_personnel
  add column if not exists unit_id uuid;

alter table public.oc_personnel
  add column if not exists unit_rank_id uuid;

create table if not exists public.command_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null unique,
  content text not null default '',
  max_capacity integer not null default 40,
  head_user_id uuid references public.oc_personnel (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint command_units_capacity_positive check (max_capacity >= 1)
);

create table if not exists public.command_unit_ranks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.command_units (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  unique (unit_id, title)
);

create table if not exists public.command_unit_announcements (
  unit_id uuid not null references public.command_units (id) on delete cascade,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  primary key (unit_id, announcement_id)
);

create table if not exists public.command_unit_applications (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.command_units (id) on delete cascade,
  user_id uuid not null references public.oc_personnel (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.oc_personnel (id) on delete set null,
  constraint command_unit_applications_status_check check (status in ('pending', 'approved', 'rejected')),
  unique (unit_id, user_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.oc_personnel (id) on delete cascade,
  category text not null,
  custom_topic text,
  body text not null,
  status text not null default 'open',
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_category_check check (
    category in ('forgot_password', 'bug', 'missing_rank', 'other')
  ),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'closed'))
);

create index if not exists command_units_head_idx on public.command_units (head_user_id);
create index if not exists command_unit_ranks_unit_idx on public.command_unit_ranks (unit_id, sort_order);
create index if not exists command_unit_applications_status_idx on public.command_unit_applications (status, created_at desc);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists oc_personnel_unit_idx on public.oc_personnel (unit_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'oc_personnel_unit_id_fkey'
  ) then
    alter table public.oc_personnel
      add constraint oc_personnel_unit_id_fkey
      foreign key (unit_id) references public.command_units (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'oc_personnel_unit_rank_id_fkey'
  ) then
    alter table public.oc_personnel
      add constraint oc_personnel_unit_rank_id_fkey
      foreign key (unit_rank_id) references public.command_unit_ranks (id) on delete set null;
  end if;
end
$$;

insert into public.command_units (code, name, sort_order) values
  ('QLD', '(QLD) The Queen''s Lion Divisions', 1),
  ('NMRS', '(NMRS) NAVAL MEDICAL AND RESCUE SERVICE', 2),
  ('9TH Sub', '(9TH Sub) 9TH SUBMARINE FLEET', 3),
  ('220TH HR', '(220TH HR) 220TH HEAVY RECON ROYAL MARINES', 4),
  ('SAWA', '(SAWA) ANTI SUBMARINE WARFARE AND UNDER WARTER ATTACKING', 5),
  ('NCD +', '(NCD +) NAVAL COMBAT DIVISION PLUS', 6),
  ('SLAA', '(SLAA) SEA LION AIR ARMS', 7),
  ('SLMF', '(SLMF) SUPPORT LION MARINES FLEET', 8),
  ('RFA', '(RFA) WLR LOGISTICS FLEET AUXILIARY', 9),
  ('11TH', '(11TH) WLR 11TH Rapier Lion division', 10),
  ('SNS', '(SNS) SPECIAL NEPTUNE SERVICES', 11),
  ('ANMF', '(ANMF) ANTI NAVAL MINE FLEET', 12),
  ('EWD', '(EWD) ELECTRONICS WARFARE DIVISION', 13),
  ('6TH FGF', '(6TH FGF) WLR 6TH frigate fleet division', 14),
  ('CSGF', '(CSGF) CARRIER STRIKE GROUP FLEET', 15),
  ('NDS', '(NDS) NAVAL DOCKYARD SERVICS', 16),
  ('ACP', '(ACP) COMBAT PARATROOPSER', 17)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

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
      and head_user_id = auth.uid()
  );
$$;

create or replace function private.can_manage_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_command_admin() or private.is_unit_head(p_unit_id);
$$;

revoke all on function private.is_unit_head(uuid) from public, anon;
revoke all on function private.can_manage_unit(uuid) from public, anon;
grant execute on function private.is_unit_head(uuid) to authenticated;
grant execute on function private.can_manage_unit(uuid) to authenticated;

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

  if new.email is distinct from old.email then
    raise exception 'Email must be changed through Auth.';
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

create or replace function private.enforce_unit_head_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.head_user_id is distinct from old.head_user_id and not private.is_command_admin() then
    raise exception 'Only command administrators can appoint unit heads.';
  end if;
  return new;
end;
$$;

drop trigger if exists command_units_head_guard on public.command_units;
create trigger command_units_head_guard
  before update on public.command_units
  for each row execute procedure private.enforce_unit_head_guard();

create or replace function private.touch_support_tickets()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch
  before update on public.support_tickets
  for each row execute procedure private.touch_support_tickets();

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
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;

  select max_capacity into capacity from public.command_units where id = p_unit_id;
  if capacity is null then
    raise exception 'Unit was not found.';
  end if;

  if exists (select 1 from public.oc_personnel where id = auth.uid() and unit_id is not null) then
    raise exception 'You already belong to a unit.';
  end if;

  if exists (
    select 1 from public.command_unit_applications
    where user_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'You already have a pending unit application.';
  end if;

  select count(*) into member_count from public.oc_personnel where unit_id = p_unit_id;
  if member_count >= capacity then
    raise exception 'Unit is at full capacity.';
  end if;

  insert into public.command_unit_applications (unit_id, user_id, status)
  values (p_unit_id, auth.uid(), 'pending')
  on conflict (unit_id, user_id) do update
    set status = 'pending',
        created_at = now(),
        reviewed_at = null,
        reviewed_by = null
  returning id into application_id;

  return application_id;
end;
$$;

create or replace function public.review_unit_application(p_application_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.command_unit_applications%rowtype;
  member_count integer;
  capacity integer;
  unit_name text;
begin
  select * into rec from public.command_unit_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application was not found.';
  end if;
  if rec.status <> 'pending' then
    raise exception 'Application is no longer pending.';
  end if;
  if not private.can_manage_unit(rec.unit_id) then
    raise exception 'Only the unit head or a command administrator can review applications.';
  end if;

  if p_approve then
    if exists (select 1 from public.oc_personnel where id = rec.user_id and unit_id is not null) then
      raise exception 'This personnel already belongs to a unit.';
    end if;
    select max_capacity, name into capacity, unit_name from public.command_units where id = rec.unit_id;
    select count(*) into member_count from public.oc_personnel where unit_id = rec.unit_id;
    if member_count >= capacity then
      raise exception 'Unit is at full capacity.';
    end if;
    update public.oc_personnel
      set unit_id = rec.unit_id,
          unit_rank_id = null,
          wlc_agency = unit_name
      where id = rec.user_id;
    update public.command_unit_applications
      set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
      where id = p_application_id;
  else
    update public.command_unit_applications
      set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
      where id = p_application_id;
  end if;
end;
$$;

create or replace function public.set_unit_head(p_unit_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_name text;
begin
  if not private.is_command_admin() then
    raise exception 'Only command administrators can appoint unit heads.';
  end if;
  if not exists (select 1 from public.command_units where id = p_unit_id) then
    raise exception 'Unit was not found.';
  end if;
  if p_user_id is not null and not exists (select 1 from public.oc_personnel where id = p_user_id) then
    raise exception 'Personnel was not found.';
  end if;

  select name into unit_name from public.command_units where id = p_unit_id;

  update public.command_units
    set head_user_id = p_user_id
    where id = p_unit_id;

  if p_user_id is not null then
    update public.oc_personnel
      set unit_id = p_unit_id,
          wlc_agency = unit_name
      where id = p_user_id;
  end if;
end;
$$;

create or replace function public.set_unit_member_rank(p_user_id uuid, p_rank_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_unit uuid;
  rank_unit uuid;
begin
  select unit_id into member_unit from public.oc_personnel where id = p_user_id;
  if member_unit is null then
    raise exception 'This personnel is not assigned to a unit.';
  end if;
  if not private.can_manage_unit(member_unit) then
    raise exception 'Only the unit head or a command administrator can assign unit ranks.';
  end if;
  if p_rank_id is null then
    update public.oc_personnel set unit_rank_id = null where id = p_user_id;
    return;
  end if;
  select unit_id into rank_unit from public.command_unit_ranks where id = p_rank_id;
  if rank_unit is distinct from member_unit then
    raise exception 'That rank does not belong to this unit.';
  end if;
  update public.oc_personnel set unit_rank_id = p_rank_id where id = p_user_id;
end;
$$;

create or replace function public.remove_unit_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_unit uuid;
begin
  select unit_id into member_unit from public.oc_personnel where id = p_user_id;
  if member_unit is null then
    raise exception 'This personnel is not assigned to a unit.';
  end if;
  if not private.can_manage_unit(member_unit) then
    raise exception 'Only the unit head or a command administrator can remove members.';
  end if;
  update public.command_units set head_user_id = null where head_user_id = p_user_id;
  update public.oc_personnel
    set unit_id = null, unit_rank_id = null, wlc_agency = null
    where id = p_user_id;
end;
$$;

create or replace function public.delete_personnel_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not private.is_command_admin() then
    raise exception 'Only command administrators can delete personnel.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;
  if exists (select 1 from public.oc_personnel where id = p_user_id and role = 'admin')
     and (select count(*) from public.oc_personnel where role = 'admin') <= 1 then
    raise exception 'The last administrator cannot be deleted.';
  end if;
  if not exists (select 1 from public.oc_personnel where id = p_user_id) then
    raise exception 'Personnel was not found.';
  end if;

  insert into public.activity_logs (user_id, role_snapshot, action_type, details)
  values (auth.uid(), 'admin', 'personnel_delete', concat('Deleted personnel record ', p_user_id::text));

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.apply_to_unit(uuid) from public, anon;
revoke all on function public.review_unit_application(uuid, boolean) from public, anon;
revoke all on function public.set_unit_head(uuid, uuid) from public, anon;
revoke all on function public.set_unit_member_rank(uuid, uuid) from public, anon;
revoke all on function public.remove_unit_member(uuid) from public, anon;
revoke all on function public.delete_personnel_account(uuid) from public, anon;

grant execute on function public.apply_to_unit(uuid) to authenticated;
grant execute on function public.review_unit_application(uuid, boolean) to authenticated;
grant execute on function public.set_unit_head(uuid, uuid) to authenticated;
grant execute on function public.set_unit_member_rank(uuid, uuid) to authenticated;
grant execute on function public.remove_unit_member(uuid) to authenticated;
grant execute on function public.delete_personnel_account(uuid) to authenticated;

alter table public.command_units enable row level security;
alter table public.command_unit_ranks enable row level security;
alter table public.command_unit_announcements enable row level security;
alter table public.command_unit_applications enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists command_units_public_select on public.command_units;
create policy command_units_public_select
  on public.command_units for select using (true);

drop policy if exists command_units_admin_insert on public.command_units;
create policy command_units_admin_insert
  on public.command_units for insert to authenticated
  with check (private.is_command_admin());

drop policy if exists command_units_manage_update on public.command_units;
create policy command_units_manage_update
  on public.command_units for update to authenticated
  using (private.can_manage_unit(id))
  with check (private.can_manage_unit(id));

drop policy if exists command_unit_ranks_public_select on public.command_unit_ranks;
create policy command_unit_ranks_public_select
  on public.command_unit_ranks for select using (true);

drop policy if exists command_unit_ranks_manage_write on public.command_unit_ranks;
create policy command_unit_ranks_manage_write
  on public.command_unit_ranks for all to authenticated
  using (private.can_manage_unit(unit_id))
  with check (private.can_manage_unit(unit_id));

drop policy if exists command_unit_announcements_public_select on public.command_unit_announcements;
create policy command_unit_announcements_public_select
  on public.command_unit_announcements for select using (true);

drop policy if exists command_unit_announcements_manage_write on public.command_unit_announcements;
create policy command_unit_announcements_manage_write
  on public.command_unit_announcements for all to authenticated
  using (private.can_manage_unit(unit_id))
  with check (private.can_manage_unit(unit_id));

drop policy if exists command_unit_applications_select on public.command_unit_applications;
create policy command_unit_applications_select
  on public.command_unit_applications for select to authenticated
  using (user_id = auth.uid() or private.can_manage_unit(unit_id));

drop policy if exists command_unit_applications_self_insert on public.command_unit_applications;
create policy command_unit_applications_self_insert
  on public.command_unit_applications for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select
  on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or private.is_command_admin());

drop policy if exists support_tickets_self_insert on public.support_tickets;
create policy support_tickets_self_insert
  on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists support_tickets_admin_update on public.support_tickets;
create policy support_tickets_admin_update
  on public.support_tickets for update to authenticated
  using (private.is_command_admin())
  with check (private.is_command_admin());

grant select on public.command_units, public.command_unit_ranks, public.command_unit_announcements to anon, authenticated;
grant select on public.command_unit_applications, public.support_tickets to authenticated;
grant insert, update on public.command_units to authenticated;
grant insert, update, delete on public.command_unit_ranks, public.command_unit_announcements to authenticated;
grant insert on public.command_unit_applications, public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;

alter table public.support_tickets
  alter column user_id drop not null;

alter table public.support_tickets
  add column if not exists contact_email text;

drop policy if exists support_tickets_anon_insert on public.support_tickets;
create policy support_tickets_anon_insert
  on public.support_tickets for insert to anon
  with check (
    user_id is null
    and category = 'forgot_password'
    and contact_email is not null
    and length(btrim(contact_email)) > 3
  );

grant insert on public.support_tickets to anon;
