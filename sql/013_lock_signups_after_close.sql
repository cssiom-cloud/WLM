-- Prevent withdrawing from an announcement after it has been closed.
-- Run after 012_close_announcement_honor_ranks.sql

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
