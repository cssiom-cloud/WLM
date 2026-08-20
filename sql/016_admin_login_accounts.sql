-- Admin login-account page: change Auth email/password for any personnel.
-- Email updates on oc_personnel stay gated except when Auth syncs them.

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
    where id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.admin_update_login_credentials(
  p_user_id uuid,
  p_email text default null,
  p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  next_email text;
  next_password text;
  current_email text;
begin
  if not private.is_command_admin() then
    raise exception 'Only command administrators can update login credentials.';
  end if;

  if not exists (select 1 from public.oc_personnel where id = p_user_id) then
    raise exception 'Personnel was not found.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Account was not found.';
  end if;

  next_email := nullif(btrim(coalesce(p_email, '')), '');
  next_password := nullif(p_password, '');

  if next_email is null and next_password is null then
    raise exception 'No login credential changes were provided.';
  end if;

  select email into current_email from auth.users where id = p_user_id;

  if next_email is not null and lower(next_email) is distinct from lower(coalesce(current_email, '')) then
    if next_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Enter a valid email address.';
    end if;
    if exists (
      select 1
      from auth.users
      where id <> p_user_id
        and lower(email) = lower(next_email)
    ) then
      raise exception 'This email is already registered.';
    end if;

    update auth.users
    set
      email = next_email,
      raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(next_email)),
      updated_at = now()
    where id = p_user_id;

    update auth.identities
    set
      identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(next_email)),
      updated_at = now()
    where user_id = p_user_id
      and provider = 'email';
  end if;

  if next_password is not null then
    if char_length(next_password) < 6 then
      raise exception 'Password must be at least 6 characters.';
    end if;

    update auth.users
    set
      encrypted_password = extensions.crypt(next_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
    where id = p_user_id;
  end if;

  insert into public.activity_logs (user_id, role_snapshot, action_type, details)
  values (
    auth.uid(),
    'admin',
    'login_credentials_update',
    concat('Updated login credentials for ', p_user_id::text)
  );
end;
$$;

revoke all on function public.admin_update_login_credentials(uuid, text, text) from public, anon;
grant execute on function public.admin_update_login_credentials(uuid, text, text) to authenticated;
