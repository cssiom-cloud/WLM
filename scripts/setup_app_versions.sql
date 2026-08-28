-- White Lion Regiment - Supabase App Versions Setup
-- Run this in Supabase SQL Editor:

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

alter table public.app_versions enable row level security;

create policy "Allow read access for all users on app_versions"
  on public.app_versions for select using (is_active = true);

create policy "Allow management on app_versions"
  on public.app_versions for all using (auth.role() = 'service_role' or auth.role() = 'authenticated');

insert into public.app_versions (version, release_date, download_url, portable_url, release_notes, is_critical, is_active)
values (
  '1.0.6', 
  now(), 
  'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal%20Setup%201.0.6.exe', 
  'https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal-v1.0.6-Portable.exe', 
  'Official release with Hardware-level Windows Hello biometrics, 1-Click Installer, and Live Hot-Patcher system.', 
  false, 
  true
)
on conflict (version) do nothing;
