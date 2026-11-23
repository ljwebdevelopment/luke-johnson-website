-- lukehjohnson.com: one-time database setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- Safe to run more than once.
--
-- Anyone can READ columns and outlets (the public site needs that).
-- Only accounts listed in public.admins can ADD, EDIT, or DELETE them.
-- Your password lives in Supabase Auth and never appears in this code.

-- ---------- Who may edit ----------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies on admins: nobody can read or change it through the website.
-- Admins are added only here, in the SQL editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- Outlets (newspapers and sites that ran Luke's work) ----------

create table if not exists public.outlets (
  id bigint generated always as identity primary key,
  name text not null unique,
  location text not null default '',      -- "City, State" or "National"
  type text not null default 'Newspaper',  -- Newspaper, Media Outlet, Wire Service
  scope text not null default 'Regional',  -- Local, Regional, National
  website text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Pieces (columns and features) ----------

create table if not exists public.pieces (
  id bigint generated always as identity primary key,
  title text not null,
  type text not null default 'Column',     -- Column, Feature, Feature / Speaking
  category text not null default '',
  description text not null default '',
  outlets text[] not null default '{}',    -- outlet names, first one is shown first
  published_on date,                       -- used for ordering, newest first
  date_label text not null default '',     -- optional text shown instead, e.g. "July 2026"
  image_url text not null default '',      -- optional cover photo
  links jsonb not null default '[]',       -- original article links (not shown on the site)
  badges text[] not null default '{}',     -- topics, used for search
  position integer not null default 0,     -- tie-breaker for the same date
  created_at timestamptz not null default now()
);

-- ---------- Row level security ----------

alter table public.outlets enable row level security;
alter table public.pieces enable row level security;

do $$
declare t text;
begin
  foreach t in array array['outlets', 'pieces'] loop
    execute format('drop policy if exists "Anyone can read" on public.%I', t);
    execute format('drop policy if exists "Admins can add" on public.%I', t);
    execute format('drop policy if exists "Admins can edit" on public.%I', t);
    execute format('drop policy if exists "Admins can delete" on public.%I', t);
    execute format('create policy "Anyone can read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "Admins can add" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Admins can edit" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Admins can delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

grant select on public.outlets, public.pieces to anon, authenticated;
grant insert, update, delete on public.outlets, public.pieces to authenticated;

-- ---------- Cover photo storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload covers" on storage.objects;
drop policy if exists "Admins can replace covers" on storage.objects;
drop policy if exists "Admins can delete covers" on storage.objects;
create policy "Admins can upload covers" on storage.objects
  for insert to authenticated with check (bucket_id = 'covers' and (select public.is_admin()));
create policy "Admins can replace covers" on storage.objects
  for update to authenticated using (bucket_id = 'covers' and (select public.is_admin()));
create policy "Admins can delete covers" on storage.objects
  for delete to authenticated using (bucket_id = 'covers' and (select public.is_admin()));

-- ---------- Make yourself an admin ----------
-- After you've been invited (Authentication > Users > Add user > Send invitation)
-- and set your password, run this once with your own email address:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'YOUR-EMAIL-HERE'
--   on conflict do nothing;
