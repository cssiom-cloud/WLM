-- Announcement participant roster visibility and optional capacity limit.

alter table public.announcements
  add column if not exists show_participants boolean not null default true,
  add column if not exists capacity_limited boolean not null default true;

create or replace function private.enforce_signup_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  capacity integer;
  limited boolean;
begin
  select count(*) into current_count
  from public.announcement_signups
  where announcement_id = new.announcement_id;

  select max_capacity, capacity_limited into capacity, limited
  from public.announcements
  where id = new.announcement_id;

  if capacity is null then
    raise exception 'Announcement was not found.';
  end if;

  if coalesce(limited, true) is not true then
    return new;
  end if;

  if current_count >= capacity then
    raise exception 'Announcement is at full capacity.';
  end if;

  return new;
end;
$$;
