-- ============================================================
-- OS SECOS - Schema Completo Discord-Style (Supabase SQL)
-- ============================================================

-- 1. Tabela de mensagens das salas em tempo real
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id text not null,
  username text not null,
  avatar_url text not null,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists image_url text;

create index if not exists idx_messages_room_created
  on public.messages (room_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "Leitura liberada para todos na sala" on public.messages;
create policy "Leitura liberada para todos na sala"
  on public.messages for select using (true);

drop policy if exists "Insercao liberada para membros" on public.messages;
create policy "Insercao liberada para membros"
  on public.messages for insert with check (true);

-- 2. Tabela de canais (Texto e Voz/Tela)
create table if not exists public.channels (
  id text primary key,
  name text not null,
  description text not null default '',
  type text not null check (type in ('text', 'voice')),
  position int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.channels enable row level security;

drop policy if exists "Channels select all" on public.channels;
create policy "Channels select all" on public.channels for select using (true);

drop policy if exists "Channels insert all" on public.channels;
create policy "Channels insert all" on public.channels for insert with check (true);

drop policy if exists "Channels delete all" on public.channels;
create policy "Channels delete all" on public.channels for delete using (true);

-- Canais padrão iniciais
insert into public.channels (id, name, description, type, position) values
  ('chat-geral', 'chat-geral', 'Chat principal da comunidade Os Secos', 'text', 1),
  ('clips-e-prints', 'clips-e-prints', 'Mande seus clipes, memes e prints', 'text', 2),
  ('resenha', 'Resenha Geral', 'Canal de voz e tela principal', 'voice', 3),
  ('gameplay', 'Gameplay 120fps', 'Telagem de jogos sem travar', 'voice', 4),
  ('cinema', 'Watch Party', 'Filmes, vídeos e lives', 'voice', 5)
on conflict (id) do nothing;

-- 3. Tabela de cargos (Roles estilo Discord)
create table if not exists public.roles (
  id text primary key,
  name text not null,
  color text not null default '#f59e0b',
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;

drop policy if exists "Roles select all" on public.roles;
create policy "Roles select all" on public.roles for select using (true);

drop policy if exists "Roles insert all" on public.roles;
create policy "Roles insert all" on public.roles for insert with check (true);

drop policy if exists "Roles update all" on public.roles;
create policy "Roles update all" on public.roles for update using (true);

drop policy if exists "Roles delete all" on public.roles;
create policy "Roles delete all" on public.roles for delete using (true);

-- Cargos iniciais da comunidade Os Secos
insert into public.roles (id, name, color, position) values
  ('fundador', 'Fundador Seco', '#f59e0b', 1),
  ('admin', 'Admin da Cova', '#ef4444', 2),
  ('streamer', 'Telador 120fps', '#a855f7', 3),
  ('seco-raiz', 'Seco Raiz', '#22c55e', 4),
  ('coveiro', 'Coveiro', '#3b82f6', 5)
on conflict (id) do nothing;

-- 4. Tabela de membros e seus cargos
create table if not exists public.user_profiles (
  id text primary key,
  username text not null,
  avatar_url text not null,
  role_id text references public.roles(id) on delete set null default 'seco-raiz',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists joined_at timestamptz not null default now();
alter table public.user_profiles add column if not exists last_seen_at timestamptz not null default now();
alter table public.user_profiles add column if not exists role_ids text[] not null default array['seco-raiz']::text[];

update public.user_profiles
set role_ids = array[role_id]
where role_id is not null and (role_ids is null or array_length(role_ids, 1) is null);

alter table public.user_profiles enable row level security;

drop policy if exists "Profiles select all" on public.user_profiles;
create policy "Profiles select all" on public.user_profiles for select using (true);

drop policy if exists "Profiles upsert all" on public.user_profiles;
create policy "Profiles upsert all" on public.user_profiles for insert with check (true);

drop policy if exists "Profiles update all" on public.user_profiles;
create policy "Profiles update all" on public.user_profiles for update using (true);

-- Habilita Realtime nas novas tabelas
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'channels'
  ) then
    alter publication supabase_realtime add table public.channels;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'roles'
  ) then
    alter publication supabase_realtime add table public.roles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_profiles'
  ) then
    alter publication supabase_realtime add table public.user_profiles;
  end if;
end $$;

-- 5. Bucket de Storage para imagens/screenshots do chat
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Chat images select all" on storage.objects;
create policy "Chat images select all"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "Chat images insert all" on storage.objects;
create policy "Chat images insert all"
  on storage.objects for insert
  with check (bucket_id = 'chat-images');
