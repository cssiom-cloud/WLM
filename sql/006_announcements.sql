-- Announcements hub: official announcements with limited-capacity signups.
-- Run after 005_user_settings_and_logs.sql

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  max_capacity integer not null,
  created_by uuid references public.oc_personnel (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint announcements_capacity_positive check (max_capacity >= 1)
);

create table if not exists public.announcement_signups (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.oc_personnel (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcements_created_idx on public.announcements (created_at desc);
create index if not exists announcement_signups_user_idx on public.announcement_signups (user_id);

alter table public.announcements enable row level security;
alter table public.announcement_signups enable row level security;

-- Reject signups beyond max_capacity at the database level.
create or replace function private.enforce_signup_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  capacity integer;
begin
  select count(*) into current_count
  from public.announcement_signups
  where announcement_id = new.announcement_id;

  select max_capacity into capacity
  from public.announcements
  where id = new.announcement_id;

  if capacity is null then
    raise exception 'Announcement was not found.';
  end if;

  if current_count >= capacity then
    raise exception 'Announcement is at full capacity.';
  end if;

  return new;
end;
$$;

drop trigger if exists announcement_signups_capacity_guard on public.announcement_signups;
create trigger announcement_signups_capacity_guard
  before insert on public.announcement_signups
  for each row execute procedure private.enforce_signup_capacity();

-- Announcements: everyone can read; only admins manage.
drop policy if exists announcements_public_select on public.announcements;
create policy announcements_public_select
  on public.announcements
  for select
  using (true);

drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert
  on public.announcements
  for insert
  to authenticated
  with check (private.is_command_admin() and created_by = auth.uid());

drop policy if exists announcements_admin_update on public.announcements;
create policy announcements_admin_update
  on public.announcements
  for update
  to authenticated
  using (private.is_command_admin())
  with check (private.is_command_admin());

drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_delete
  on public.announcements
  for delete
  to authenticated
  using (private.is_command_admin());

-- Signups: everyone can read counts; users manage only their own row.
drop policy if exists announcement_signups_public_select on public.announcement_signups;
create policy announcement_signups_public_select
  on public.announcement_signups
  for select
  using (true);

drop policy if exists announcement_signups_self_insert on public.announcement_signups;
create policy announcement_signups_self_insert
  on public.announcement_signups
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists announcement_signups_self_delete on public.announcement_signups;
create policy announcement_signups_self_delete
  on public.announcement_signups
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select on public.announcements, public.announcement_signups to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant insert, delete on public.announcement_signups to authenticated;
