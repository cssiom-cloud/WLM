-- Auth signup runs as supabase_auth_admin. Schema private was granted only to
-- postgres/service_role, so the on_auth_user_created trigger failed with
-- "Database error saving new user".

grant usage on schema private to supabase_auth_admin;

create or replace function private.handle_new_personnel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.oc_personnel (id, email, role, military_rank)
  values (new.id, new.email, 'user', 'Lieutenant')
  on conflict (id) do nothing;
  return new;
end;
$$;

grant execute on function private.handle_new_personnel() to supabase_auth_admin;
grant execute on function private.sync_personnel_email() to supabase_auth_admin;
