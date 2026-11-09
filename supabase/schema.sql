-- ============================================================
-- OS SECOS - Schema Inicial para o Supabase (SQL Editor)
-- ============================================================

-- 1. Tabela de mensagens das salas em tempo real
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id text not null,
  username text not null,
  avatar_url text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Index para acelerar busca de mensagens por sala
create index if not exists idx_messages_room_created
  on public.messages (room_id, created_at desc);

-- Habilita Row Level Security (RLS)
alter table public.messages enable row level security;

-- Política de leitura pública para membros na sala
create policy "Leitura liberada para todos na sala"
  on public.messages for select
  using (true);

-- Política de envio de mensagens
create policy "Insercao liberada para membros"
  on public.messages for insert
  with check (true);

-- Habilita Realtime na tabela messages
alter publication supabase_realtime add table public.messages;

