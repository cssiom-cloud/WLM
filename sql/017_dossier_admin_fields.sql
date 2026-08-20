-- Dossier admin fields: override radar stats and service timeline from the profile editor.

alter table public.oc_personnel
  add column if not exists service_skills jsonb not null default '{}'::jsonb;

alter table public.oc_personnel
  add column if not exists service_timeline jsonb not null default '[]'::jsonb;

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
