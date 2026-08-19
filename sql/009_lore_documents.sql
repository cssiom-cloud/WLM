-- Dynamic content: lore archive entries and official documents, managed by admins.
-- Run after 008_service_records.sql

create table if not exists public.lore_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('timeline', 'geopolitics', 'naval')),
  title text not null,
  meta1 text,
  meta2 text,
  body text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.command_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  markdown text not null default '',
  created_by uuid references public.oc_personnel (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lore_entries_category_idx on public.lore_entries (category, sort_order);

alter table public.lore_entries enable row level security;
alter table public.command_documents enable row level security;

create or replace function private.touch_command_documents()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists command_documents_touch on public.command_documents;
create trigger command_documents_touch
  before update on public.command_documents
  for each row execute procedure private.touch_command_documents();

-- Everyone reads; only command admins write.
drop policy if exists lore_entries_public_select on public.lore_entries;
create policy lore_entries_public_select
  on public.lore_entries for select using (true);

drop policy if exists lore_entries_admin_write on public.lore_entries;
create policy lore_entries_admin_write
  on public.lore_entries for all
  to authenticated
  using (private.is_command_admin())
  with check (private.is_command_admin());

drop policy if exists command_documents_public_select on public.command_documents;
create policy command_documents_public_select
  on public.command_documents for select using (true);

drop policy if exists command_documents_admin_write on public.command_documents;
create policy command_documents_admin_write
  on public.command_documents for all
  to authenticated
  using (private.is_command_admin())
  with check (private.is_command_admin());

grant select on public.lore_entries, public.command_documents to anon, authenticated;
grant insert, update, delete on public.lore_entries, public.command_documents to authenticated;

-- Seed content (safe to re-run).
insert into public.lore_entries (id, category, title, meta1, meta2, body, sort_order) values
  ('20000000-0000-4000-8000-000000000001', 'timeline', 'Formation of the White Lion Regiment', 'Founding Era', null, 'The regiment is established as a joint Navy and Marines command under a unified fleet charter.', 1),
  ('20000000-0000-4000-8000-000000000002', 'timeline', 'Naval Academy Commissioned', 'Expansion Era', null, 'The academy opens to train students and trainers, formalizing the NS and TR programs.', 2),
  ('20000000-0000-4000-8000-000000000003', 'timeline', 'Union Republic of Eridian Accords', 'Modern Era', null, 'Joint operating agreements define fleet patrol zones and combined training exercises.', 3),
  ('20000000-0000-4000-8000-000000000011', 'geopolitics', 'Aquilish', 'Recognized nationality', null, 'Personnel of Aquilish origin serve across both branches.', 1),
  ('20000000-0000-4000-8000-000000000012', 'geopolitics', 'Renjima', 'Recognized nationality', null, 'Personnel of Renjima origin serve across both branches.', 2),
  ('20000000-0000-4000-8000-000000000013', 'geopolitics', 'Schwartland', 'Recognized nationality', null, 'Personnel of Schwartland origin serve across both branches.', 3),
  ('20000000-0000-4000-8000-000000000014', 'geopolitics', 'Union Republic of Eridian', 'Allied state', null, 'Treaty partner for joint fleet operations and naval specifications.', 4),
  ('20000000-0000-4000-8000-000000000021', 'naval', 'Eridian-class', 'Fleet flagship', '420', 'Fleet command and coordination', 1),
  ('20000000-0000-4000-8000-000000000022', 'naval', 'Lionheart-class', 'Cruiser', '260', 'Escort and patrol operations', 2),
  ('20000000-0000-4000-8000-000000000023', 'naval', 'Whitecrest-class', 'Landing ship', '180', 'Marine amphibious deployment', 3),
  ('20000000-0000-4000-8000-000000000024', 'naval', 'Academy Sloop', 'Training vessel', '60', 'Naval academy instruction', 4)
on conflict (id) do nothing;

insert into public.command_documents (id, title, markdown) values
  ('30000000-0000-4000-8000-000000000001', 'General Regulations', '# General Regulations' || E'\n\n' || '## Conduct' || E'\n' || '- Personnel address superiors by rank at all times.' || E'\n' || '- Uniform standards apply during all official operations.'),
  ('30000000-0000-4000-8000-000000000002', 'Operations Manual', '# Operations Manual' || E'\n\n' || '## Registration' || E'\n' || '- Operations are published in the Announcements Hub.' || E'\n' || '- Each operation lists its maximum capacity.'),
  ('30000000-0000-4000-8000-000000000003', 'Recruit Guide', '# Recruit Guide' || E'\n\n' || '## Getting Started' || E'\n' || '- New members enter at the rank of Lieutenant.' || E'\n' || '- Complete your profile on the Home page.')
on conflict (id) do nothing;
