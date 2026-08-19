-- Allow the first admin bootstrap from SQL Editor.
-- The column guard previously blocked role changes whenever auth.uid() was
-- null, which is always true in the dashboard SQL Editor.

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
  end if;

  return new;
end;
$$;
