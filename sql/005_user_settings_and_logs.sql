-- Patch: biography, user_settings, activity_logs, command status

alter table public.oc_personnel
  add column if not exists biography text;

create table if not exists public.user_settings (
  user_id uuid primary key references public.oc_personnel (id) on delete cascade,
  theme_accent text,
  bio_public boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint user_settings_theme_accent_hex check (
    theme_accent is null or theme_accent ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create table if not exists public.activity_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.oc_personnel (id) on delete set null,
  role_snapshot text,
  action_type text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_user_idx on public.activity_logs (user_id);
create index if not exists activity_logs_action_idx on public.activity_logs (action_type);

alter table public.user_settings enable row level security;
alter table public.activity_logs enable row level security;

create or replace function private.touch_user_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch
  before update on public.user_settings
  for each row execute procedure private.touch_user_settings();

create or replace function private.handle_new_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id, bio_public)
  values (new.id, true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_personnel_settings_created on public.oc_personnel;
create trigger on_personnel_settings_created
  after insert on public.oc_personnel
  for each row execute procedure private.handle_new_user_settings();

insert into public.user_settings (user_id, bio_public)
select id, true
from public.oc_personnel
on conflict (user_id) do nothing;

create or replace function private.log_personnel_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if not private.is_command_admin() then
    return new;
  end if;

  select role::text into actor_role
  from public.oc_personnel
  where id = auth.uid();

  if tg_op = 'UPDATE' and new.id is distinct from auth.uid() then
    if new.military_rank is distinct from old.military_rank then
      insert into public.activity_logs (user_id, role_snapshot, action_type, details)
      values (
        auth.uid(),
        actor_role,
        'rank_update',
        concat('Updated rank for ', new.id::text, ' to ', new.military_rank)
      );
    end if;

    if new.role is distinct from old.role then
      insert into public.activity_logs (user_id, role_snapshot, action_type, details)
      values (
        auth.uid(),
        actor_role,
        case when new.role = 'admin' then 'admin_grant' else 'admin_revoke' end,
        concat('Changed role for ', new.id::text, ' to ', new.role::text)
      );
    end if;

    if new is distinct from old
       and new.military_rank is not distinct from old.military_rank
       and new.role is not distinct from old.role then
      insert into public.activity_logs (user_id, role_snapshot, action_type, details)
      values (
        auth.uid(),
        actor_role,
        'personnel_edit',
        concat('Edited personnel record ', new.id::text)
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    insert into public.activity_logs (user_id, role_snapshot, action_type, details)
    values (
      auth.uid(),
      actor_role,
      'personnel_delete',
      concat('Deleted personnel record ', old.id::text)
    );
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists oc_personnel_admin_activity on public.oc_personnel;
create trigger oc_personnel_admin_activity
  after update or delete on public.oc_personnel
  for each row execute procedure private.log_personnel_admin_activity();

drop policy if exists user_settings_public_select on public.user_settings;
create policy user_settings_public_select
  on public.user_settings
  for select
  using (true);

drop policy if exists user_settings_self_insert on public.user_settings;
create policy user_settings_self_insert
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_settings_self_update on public.user_settings;
create policy user_settings_self_update
  on public.user_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select
  on public.activity_logs
  for select
  to authenticated
  using (user_id = auth.uid() or private.is_command_admin());

drop policy if exists activity_logs_insert_self on public.activity_logs;
create policy activity_logs_insert_self
  on public.activity_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

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

revoke all on function public.command_system_status() from public;
grant execute on function public.command_system_status() to anon, authenticated;

grant select on public.user_settings to anon, authenticated;
grant insert, update on public.user_settings to authenticated;
grant select, insert on public.activity_logs to authenticated;
