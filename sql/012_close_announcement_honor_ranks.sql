-- Close announcements, optional honor ranks, and lock command_system_status to signed-in users.
-- Run after 011_bootstrap_admin_guard.sql
--
-- HaveIBeenPwned leaked-password protection is not a SQL setting.
-- Enable it in Dashboard: Authentication → Providers → Email → Leaked password protection.
-- That toggle requires a Pro plan (or above).

alter table public.announcements
  add column if not exists ended_at timestamptz;

alter table public.announcements
  add column if not exists award_honor_enabled boolean not null default false;

alter table public.announcements
  add column if not exists honor_rank_title text;

alter table public.oc_personnel
  add column if not exists honor_ranks text[] not null default '{}';

create or replace function private.enforce_signup_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  capacity integer;
  closed_at timestamptz;
begin
  select max_capacity, ended_at
    into capacity, closed_at
  from public.announcements
  where id = new.announcement_id;

  if capacity is null then
    raise exception 'Announcement was not found.';
  end if;

  if closed_at is not null then
    raise exception 'Announcement is closed.';
  end if;

  select count(*) into current_count
  from public.announcement_signups
  where announcement_id = new.announcement_id;

  if current_count >= capacity then
    raise exception 'Announcement is at full capacity.';
  end if;

  return new;
end;
$$;

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
  end if;

  return new;
end;
$$;

create or replace function public.close_announcement(p_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.announcements%rowtype;
  awarded integer := 0;
  uid uuid;
  honor_title text;
begin
  if not private.is_command_admin() then
    raise exception 'Only command administrators can close announcements.';
  end if;

  select * into rec
  from public.announcements
  where id = p_announcement_id
  for update;

  if not found then
    raise exception 'Announcement was not found.';
  end if;

  if rec.ended_at is not null then
    raise exception 'Announcement is already closed.';
  end if;

  update public.announcements
  set ended_at = now()
  where id = p_announcement_id;

  honor_title := nullif(trim(coalesce(rec.honor_rank_title, '')), '');

  if rec.award_honor_enabled and honor_title is not null then
    for uid in
      select user_id
      from public.announcement_signups
      where announcement_id = p_announcement_id
    loop
      update public.oc_personnel
      set
        honor_ranks = case
          when honor_title = any (coalesce(honor_ranks, '{}'::text[])) then honor_ranks
          else coalesce(honor_ranks, '{}'::text[]) || honor_title
        end,
        completed_missions = case
          when rec.title = any (coalesce(completed_missions, '{}'::text[])) then completed_missions
          else coalesce(completed_missions, '{}'::text[]) || rec.title
        end
      where id = uid;
      awarded := awarded + 1;
    end loop;
  end if;

  insert into public.activity_logs (user_id, role_snapshot, action_type, details)
  values (
    auth.uid(),
    'admin',
    'announcement_close',
    concat(
      'Closed announcement ',
      rec.title,
      case
        when rec.award_honor_enabled and honor_title is not null
          then concat(' and awarded honor rank ', honor_title, ' to ', awarded::text, ' personnel')
        else ''
      end
    )
  );

  return jsonb_build_object('awarded', awarded, 'honor_rank_title', honor_title);
end;
$$;

revoke all on function public.close_announcement(uuid) from public, anon;
grant execute on function public.close_announcement(uuid) to authenticated;

create or replace function public.command_system_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  used bigint;
  limit_bytes bigint := 1073741824;
begin
  select coalesce(sum(coalesce((metadata ->> 'size')::bigint, octet_length(name))), 0)
    into used
  from storage.objects
  where bucket_id = 'oc_avatars';

  return jsonb_build_object(
    'storage_used_bytes', used,
    'storage_limit_bytes', limit_bytes,
    'storage_remaining_bytes', greatest(limit_bytes - used, 0)
  );
end;
$$;

revoke all on function public.command_system_status() from public, anon;
grant execute on function public.command_system_status() to authenticated;

create or replace function private.touch_user_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.touch_command_documents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.enforce_signup_not_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_at timestamptz;
begin
  select ended_at into closed_at
  from public.announcements
  where id = old.announcement_id;

  if closed_at is not null then
    raise exception 'Announcement is closed.';
  end if;

  return old;
end;
$$;

drop trigger if exists announcement_signups_closed_guard on public.announcement_signups;
create trigger announcement_signups_closed_guard
  before delete on public.announcement_signups
  for each row execute procedure private.enforce_signup_not_closed();
