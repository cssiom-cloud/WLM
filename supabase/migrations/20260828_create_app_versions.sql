-- ==============================================================================
-- White Lion Regiment - App Versions Table for Custom Auto-Update System
-- ==============================================================================

-- 1. Create table app_versions
create table if not exists public.app_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  release_date timestamptz not null default now(),
  download_url text not null,
  portable_url text,
  release_notes text not null default '',
  is_critical boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Create index for fast lookup by active status & release date
create index if not exists idx_app_versions_active_date 
  on public.app_versions (is_active, release_date desc);

-- 3. Enable Row Level Security (RLS)
alter table public.app_versions enable row level security;

-- 4. Policy: Allow all users (anonymous and authenticated) to read active versions
drop policy if exists "Allow read access for all users on app_versions" on public.app_versions;
create policy "Allow read access for all users on app_versions"
  on public.app_versions
  for select
  using (is_active = true);

-- 5. Policy: Allow authorized personnel/service_role to manage versions
drop policy if exists "Allow management for authenticated personnel on app_versions" on public.app_versions;
create policy "Allow management for authenticated personnel on app_versions"
  on public.app_versions
  for all
  using (auth.role() = 'service_role' or auth.role() = 'authenticated')
  with check (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- 6. Insert initial records for current releases
insert into public.app_versions (
  version, 
  release_date, 
  download_url, 
  portable_url, 
  release_notes, 
  is_critical, 
  is_active
)
values 
  (
    '1.0.6', 
    now(), 
    'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal%20Setup%201.0.6.exe', 
    'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal-v1.0.6-Portable.exe', 
    'Official release with Hardware-level Windows Hello biometrics, 1-Click Installer, and Live Hot-Patcher system.', 
    false, 
    true
  )
on conflict (version) do update set
  download_url = excluded.download_url,
  portable_url = excluded.portable_url,
  release_notes = excluded.release_notes,
  is_active = excluded.is_active;
