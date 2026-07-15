-- Роли доступа, столы, телефоны подписчиков, коды входа в кабинет.
-- Этап 1: схема + управление ролями суперадмином. Авторизация владельца
-- (Telegram-код → сессия) и RLS доступа владельца добавляются этапом 2,
-- когда выбран механизм сессии.

-- ─── user_roles: кто к каким заведениям имеет доступ ──────
-- Идентичность — telegram chat_id (владелец входит по номеру → бот halo).
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (telegram_chat_id, venue_id)
);

alter table public.user_roles enable row level security;

-- Пока управляет только суперадмин (email-авторизация = authenticated).
drop policy if exists "auth manage user_roles" on public.user_roles;
create policy "auth manage user_roles"
  on public.user_roles for all
  to authenticated
  using (true)
  with check (true);

-- ─── venue_tables: столы заведения (Стол 1…N) ────────────
create table if not exists public.venue_tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  number int not null,          -- значение ?table= и порядок
  label text,                   -- «Стол 1» или произвольное имя
  created_at timestamptz not null default now(),
  unique (venue_id, number)
);

alter table public.venue_tables enable row level security;

drop policy if exists "auth manage venue_tables" on public.venue_tables;
create policy "auth manage venue_tables"
  on public.venue_tables for all
  to authenticated
  using (true)
  with check (true);

-- ─── телефон подписчика (бот собирает через «поделиться контактом») ──
alter table public.venue_subscribers
  add column if not exists phone text;

-- ─── коды входа в кабинет (одноразовые, живут минуты) ─────
create table if not exists public.cabinet_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  chat_id text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
-- Только service role (бэкенд/бот). Ни anon, ни authenticated не читают.
alter table public.cabinet_codes enable row level security;

-- ─── стол/место в гостевых заявках ───────────────────────
alter table public.ratings          add column if not exists table_no text;
alter table public.feedback         add column if not exists table_no text;
alter table public.service_requests add column if not exists table_no text;
alter table public.taxi_requests    add column if not exists table_no text;
alter table public.appointments     add column if not exists table_no text;

-- телефон владельца (суперадмин вводит при назначении) — по нему вход в кабинет
alter table public.user_roles add column if not exists phone text;
