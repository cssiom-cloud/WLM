-- ==============================================================================
-- White Lion Regiment - Document Verification Workflow Schema
-- File: sql/022_document_verification.sql
-- ==============================================================================

-- 1. Create enum for document verification status
do $$ 
begin
  if not exists (select 1 from pg_type where typname = 'document_verification_status') then
    create type document_verification_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- 2. Create user_roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'user' check (role in ('user', 'verifier', 'admin')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "Users can read own roles" on public.user_roles;
create policy "Users can read own roles"
  on public.user_roles for select
  using (auth.uid() = user_id or exists (
    select 1 from public.user_roles ur 
    where ur.user_id = auth.uid() and ur.role in ('verifier', 'admin')
  ));

-- 3. Helper function: Check if current user is a verifier or admin
create or replace function public.is_verifier_or_admin(target_uid uuid default auth.uid())
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.user_roles 
    where user_id = target_uid and role in ('verifier', 'admin')
  ) or exists (
    select 1 from public.personnel 
    where user_id = target_uid and (is_admin = true or role in ('Commander', 'Executive', 'Admin', 'Officer', 'Verifier'))
  );
$$;

-- 4. Create documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  personnel_id uuid references public.personnel(id) on delete set null,
  title text not null,
  document_type text not null default 'identification',
  file_url text not null,
  file_name text not null,
  file_size bigint default 0,
  file_type text default 'application/pdf',
  status document_verification_status not null default 'pending',
  reviewer_note text default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_status on public.documents(status, created_at desc);
create index if not exists idx_documents_user_id on public.documents(user_id, created_at desc);

-- 5. Enable Row Level Security (RLS)
alter table public.documents enable row level security;

-- Policy 1: Users can view own documents or verifiers can view all
drop policy if exists "Users can view own documents or verifiers can view all" on public.documents;
create policy "Users can view own documents or verifiers can view all"
  on public.documents for select
  using (
    auth.uid() = user_id 
    or public.is_verifier_or_admin(auth.uid())
  );

-- Policy 2: Users can insert own documents
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert
  with check (
    auth.uid() = user_id or auth.uid() is not null
  );

-- Policy 3: Verifiers and Admins can update documents
drop policy if exists "Verifiers and Admins can update documents" on public.documents;
create policy "Verifiers and Admins can update documents"
  on public.documents for update
  using (
    public.is_verifier_or_admin(auth.uid())
  )
  with check (
    public.is_verifier_or_admin(auth.uid())
  );

-- Policy 4: Users can delete own pending documents
drop policy if exists "Users can delete own pending documents" on public.documents;
create policy "Users can delete own pending documents"
  on public.documents for delete
  using (
    (auth.uid() = user_id and status = 'pending')
    or public.is_verifier_or_admin(auth.uid())
  );

-- 6. Storage Bucket: user-documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-documents',
  'user-documents',
  true,
  52428800, -- 50 MB
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

-- Storage Policies
drop policy if exists "Allow authenticated uploads to user-documents" on storage.objects;
create policy "Allow authenticated uploads to user-documents"
  on storage.objects for insert
  with check (
    bucket_id = 'user-documents' and (auth.role() = 'authenticated' or auth.role() = 'anon')
  );

drop policy if exists "Allow reading user-documents" on storage.objects;
create policy "Allow reading user-documents"
  on storage.objects for select
  using (bucket_id = 'user-documents');
