-- ==============================================================================
-- White Lion Regiment - Automated Supabase Setup SQL
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

-- 2. Index for instant query performance
create index if not exists idx_app_versions_active_date 
  on public.app_versions (is_active, release_date desc);

-- 3. Enable RLS on app_versions
alter table public.app_versions enable row level security;

-- 4. Policy: Allow all users (anonymous and authenticated) to read active versions
drop policy if exists "Allow read access for all users on app_versions" on public.app_versions;
create policy "Allow read access for all users on app_versions"
  on public.app_versions
  for select
  using (is_active = true);

-- 5. Policy: Allow authorized roles to manage app_versions
drop policy if exists "Allow management on app_versions" on public.app_versions;
create policy "Allow management on app_versions"
  on public.app_versions
  for all
  using (auth.role() = 'service_role' or auth.role() = 'authenticated')
  with check (auth.role() = 'service_role' or auth.role() = 'authenticated');

-- 6. Create Storage Bucket "app-updates" (Public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-updates',
  'app-updates',
  true,
  104857600, -- 100 MB
  array['application/x-msdownload', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 104857600;

-- 7. Policy: Allow public read access to app-updates bucket
drop policy if exists "Public access to app-updates" on storage.objects;
create policy "Public access to app-updates"
  on storage.objects
  for select
  using (bucket_id = 'app-updates');

-- 8. Insert Initial Seed Data for v1.0.1
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
    'v1.0.1', 
    now(), 
    'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal%20Setup%201.0.6.exe', 
    'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal-v1.0.6-Portable.exe', 
    'WLR Command Portal v1.0.1 - Clean Reset Release with WebAuthn Passkey support and Supabase Cloud Auto-Updater.', 
    false, 
    true
  )
on conflict (version) do update set
  download_url = excluded.download_url,
  portable_url = excluded.portable_url,
  release_notes = excluded.release_notes,
  is_active = excluded.is_active;
