-- Tactical operations board, faction assignment, map annotations, and AAR.
-- Run after 018_personnel_cover_and_avatar_admin.sql

create or replace function private.can_plan_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_command_admin()
    or exists (
      select 1
      from public.command_units
      where head_user_id = auth.uid()
    );
$$;

revoke all on function private.can_plan_operations() from public, anon;
grant execute on function private.can_plan_operations() to authenticated;

create table if not exists public.oc_operations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  briefing text not null default '',
  map_url text,
  drawings jsonb not null default '[]'::jsonb,
  status text not null default 'planning' check (status in ('planning', 'active', 'completed')),
  created_by uuid references public.oc_personnel (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_operation_sides (
  operation_id uuid not null references public.oc_operations (id) on delete cascade,
  unit_id uuid not null references public.command_units (id) on delete cascade,
  side text not null check (side in ('allies', 'objectives')),
  primary key (operation_id, unit_id)
);

create table if not exists public.oc_operation_aar (
  operation_id uuid not null references public.oc_operations (id) on delete cascade,
  unit_id uuid not null references public.command_units (id) on delete cascade,
  evaluation text not null default '',
  authored_by uuid references public.oc_personnel (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (operation_id, unit_id)
);

create index if not exists oc_operations_created_idx on public.oc_operations (created_at desc);
create index if not exists oc_operation_sides_unit_idx on public.oc_operation_sides (unit_id);
create index if not exists oc_operation_aar_op_idx on public.oc_operation_aar (operation_id);

create or replace function private.can_edit_operation(p_operation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.is_command_admin()
    or exists (
      select 1
      from public.oc_operations o
      where o.id = p_operation_id
        and o.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.oc_operation_sides s
      where s.operation_id = p_operation_id
        and private.can_manage_unit(s.unit_id)
    );
$$;

revoke all on function private.can_edit_operation(uuid) from public, anon;
grant execute on function private.can_edit_operation(uuid) to authenticated;

create or replace function private.touch_oc_operations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists oc_operations_touch on public.oc_operations;
create trigger oc_operations_touch
  before update on public.oc_operations
  for each row execute procedure private.touch_oc_operations();

create or replace function private.touch_oc_operation_aar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists oc_operation_aar_touch on public.oc_operation_aar;
create trigger oc_operation_aar_touch
  before update on public.oc_operation_aar
  for each row execute procedure private.touch_oc_operation_aar();

alter table public.oc_operations enable row level security;
alter table public.oc_operation_sides enable row level security;
alter table public.oc_operation_aar enable row level security;

drop policy if exists oc_operations_public_select on public.oc_operations;
create policy oc_operations_public_select
  on public.oc_operations for select
  using (true);

drop policy if exists oc_operations_planner_insert on public.oc_operations;
create policy oc_operations_planner_insert
  on public.oc_operations for insert
  to authenticated
  with check (private.can_plan_operations() and created_by = auth.uid());

drop policy if exists oc_operations_planner_update on public.oc_operations;
create policy oc_operations_planner_update
  on public.oc_operations for update
  to authenticated
  using (private.can_edit_operation(id))
  with check (private.can_edit_operation(id));

drop policy if exists oc_operations_planner_delete on public.oc_operations;
create policy oc_operations_planner_delete
  on public.oc_operations for delete
  to authenticated
  using (private.is_command_admin() or created_by = auth.uid());

drop policy if exists oc_operation_sides_public_select on public.oc_operation_sides;
create policy oc_operation_sides_public_select
  on public.oc_operation_sides for select
  using (true);

drop policy if exists oc_operation_sides_write on public.oc_operation_sides;
create policy oc_operation_sides_write
  on public.oc_operation_sides for all
  to authenticated
  using (private.can_edit_operation(operation_id))
  with check (private.can_edit_operation(operation_id));

drop policy if exists oc_operation_aar_public_select on public.oc_operation_aar;
create policy oc_operation_aar_public_select
  on public.oc_operation_aar for select
  using (true);

drop policy if exists oc_operation_aar_write on public.oc_operation_aar;
create policy oc_operation_aar_write
  on public.oc_operation_aar for all
  to authenticated
  using (private.can_edit_operation(operation_id))
  with check (private.can_edit_operation(operation_id));

grant select on public.oc_operations, public.oc_operation_sides, public.oc_operation_aar to anon, authenticated;
grant insert, update, delete on public.oc_operations, public.oc_operation_sides, public.oc_operation_aar to authenticated;

insert into storage.buckets (id, name, public)
values ('operation_maps', 'operation_maps', true)
on conflict (id) do update
set public = true;

drop policy if exists operation_maps_public_select on storage.objects;
create policy operation_maps_public_select
  on storage.objects for select
  to public
  using (bucket_id = 'operation_maps');

drop policy if exists operation_maps_planner_insert on storage.objects;
create policy operation_maps_planner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'operation_maps'
    and private.can_plan_operations()
  );

drop policy if exists operation_maps_planner_update on storage.objects;
create policy operation_maps_planner_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'operation_maps'
    and private.can_plan_operations()
  )
  with check (
    bucket_id = 'operation_maps'
    and private.can_plan_operations()
  );

drop policy if exists operation_maps_planner_delete on storage.objects;
create policy operation_maps_planner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'operation_maps'
    and private.can_plan_operations()
  );
