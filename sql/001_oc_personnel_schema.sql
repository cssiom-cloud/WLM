-- W.L.R Command Personnel Schema
-- Run this script in the Supabase SQL Editor first.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'military_branch_code' and n.nspname = 'public') then
    create type public.military_branch_code as enum ('Navy', 'Marines');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'nationality_code' and n.nspname = 'public') then
    create type public.nationality_code as enum ('Aquilish', 'Renjima', 'Schwartland');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'race_code' and n.nspname = 'public') then
    create type public.race_code as enum ('Human', 'Neko', 'Elf', 'Demon');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'gender_code' and n.nspname = 'public') then
    create type public.gender_code as enum ('Male', 'Female');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'app_role_code' and n.nspname = 'public') then
    create type public.app_role_code as enum ('user', 'admin');
  end if;
end
$$;

create table if not exists public.oc_rank_structure (
  rank_title text primary key,
  nato_grade text not null,
  sort_order integer not null unique
);

insert into public.oc_rank_structure (rank_title, nato_grade, sort_order) values
  ('Admiral of the Fleet', 'OF-10', 1),
  ('Admiral', 'OF-9', 2),
  ('Vice admiral', 'OF-8', 3),
  ('Rear admiral', 'OF-7', 4),
  ('Commodore', 'OF-6', 5),
  ('Captain', 'OF-5', 6),
  ('Lieutenant', 'OF-1 — OF-4', 7),
  ('Master Sergeant', 'OR-9', 8),
  ('Sergeant Major', 'OR-8', 9),
  ('Sergeant', 'OR-5', 10),
  ('Corporal', 'OR-4', 11),
  ('Private', 'OR-1 — OR-3', 12),
  ('Naval academy Trainer', 'TR', 13),
  ('Naval academy student', 'NS', 14)
on conflict (rank_title) do update
set nato_grade = excluded.nato_grade,
    sort_order = excluded.sort_order;

create table if not exists public.oc_personnel (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.app_role_code not null default 'user',
  first_name text,
  middle_name text,
  last_name text,
  age integer,
  nationality public.nationality_code,
  gender public.gender_code,
  avatar_url text,
  religion text,
  race public.race_code,
  wlc_agency text,
  training_course text,
  military_branch public.military_branch_code,
  organization_role text,
  military_rank text not null default 'Lieutenant' references public.oc_rank_structure (rank_title),
  constraint oc_personnel_age_minimum check (age is null or age >= 17)
);

create index if not exists oc_personnel_rank_idx on public.oc_personnel (military_rank);
create index if not exists oc_personnel_role_idx on public.oc_personnel (role);
create index if not exists oc_personnel_branch_idx on public.oc_personnel (military_branch);
create index if not exists oc_personnel_email_idx on public.oc_personnel (email);

alter table public.oc_rank_structure enable row level security;
alter table public.oc_personnel enable row level security;

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
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function private.is_command_admin() from public, anon, authenticated;
grant execute on function private.is_command_admin() to authenticated;
grant usage on schema private to authenticated;

create or replace function private.handle_new_personnel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.oc_personnel (id, email, role, military_rank)
  values (new.id, new.email, 'user', 'Lieutenant');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_personnel();

create or replace function private.sync_personnel_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.oc_personnel
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure private.sync_personnel_email();

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

  if not private.is_command_admin() then
    if new.military_rank is distinct from old.military_rank then
      raise exception 'military_rank is restricted.';
    end if;
    if new.role is distinct from old.role then
      raise exception 'role is restricted.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists oc_personnel_column_guard on public.oc_personnel;
create trigger oc_personnel_column_guard
  before update on public.oc_personnel
  for each row execute procedure private.enforce_personnel_column_guard();

drop policy if exists oc_rank_structure_public_select on public.oc_rank_structure;
create policy oc_rank_structure_public_select
  on public.oc_rank_structure
  for select
  using (true);

drop policy if exists oc_personnel_public_select on public.oc_personnel;
create policy oc_personnel_public_select
  on public.oc_personnel
  for select
  using (true);

drop policy if exists oc_personnel_self_update on public.oc_personnel;
create policy oc_personnel_self_update
  on public.oc_personnel
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists oc_personnel_admin_update on public.oc_personnel;
create policy oc_personnel_admin_update
  on public.oc_personnel
  for update
  to authenticated
  using (private.is_command_admin())
  with check (private.is_command_admin());

drop policy if exists oc_personnel_admin_delete on public.oc_personnel;
create policy oc_personnel_admin_delete
  on public.oc_personnel
  for delete
  to authenticated
  using (private.is_command_admin());

grant usage on schema public to anon, authenticated;

grant select on public.oc_rank_structure to anon, authenticated;
grant select on public.oc_personnel to anon, authenticated;
grant update, delete on public.oc_personnel to authenticated;

revoke insert on public.oc_personnel from anon, authenticated;
revoke insert, update, delete on public.oc_rank_structure from anon, authenticated;
