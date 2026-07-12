-- Review Hub: schema, RLS, seed
-- Выполнить в Supabase SQL Editor или через supabase db push

create extension if not exists pgcrypto;

-- ─── venues ───────────────────────────────────────────────
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  welcome_text text default 'Добро пожаловать!',
  yandex_review_url text,
  google_review_url text,
  gis2_review_url text,
  menu_url text,
  wifi_ssid text,
  wifi_password text,
  instagram_url text,
  telegram_url text,
  phone text,
  address text,
  owner_telegram_chat_id text,
  accent_color text default '#2563eb',
  created_at timestamptz not null default now()
);

-- ─── ratings ──────────────────────────────────────────────
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  redirected_to text check (redirected_to in ('yandex', 'google', '2gis')),
  created_at timestamptz not null default now()
);

-- ─── feedback ─────────────────────────────────────────────
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  message text not null,
  contact text,
  created_at timestamptz not null default now()
);

-- ─── scans ────────────────────────────────────────────────
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────
-- anon: select venues, insert ratings/feedback/scans. Всё остальное — только service role.
alter table public.venues enable row level security;
alter table public.ratings enable row level security;
alter table public.feedback enable row level security;
alter table public.scans enable row level security;

drop policy if exists "anon can read venues" on public.venues;
create policy "anon can read venues"
  on public.venues for select
  to anon
  using (true);

drop policy if exists "anon can insert ratings" on public.ratings;
create policy "anon can insert ratings"
  on public.ratings for insert
  to anon
  with check (true);

-- нужен select после insert (возвращаем id созданной оценки)
drop policy if exists "anon can read ratings" on public.ratings;
create policy "anon can read ratings"
  on public.ratings for select
  to anon
  using (true);

drop policy if exists "anon can insert feedback" on public.feedback;
create policy "anon can insert feedback"
  on public.feedback for insert
  to anon
  with check (true);

drop policy if exists "anon can insert scans" on public.scans;
create policy "anon can insert scans"
  on public.scans for insert
  to anon
  with check (true);

-- ─── Seed: демо-заведение ─────────────────────────────────
insert into public.venues (
  slug, name, logo_url, welcome_text,
  yandex_review_url, google_review_url, gis2_review_url,
  menu_url, wifi_ssid, wifi_password,
  instagram_url, telegram_url, phone, address,
  owner_telegram_chat_id, accent_color
) values (
  'demo',
  'Кофейня DEMO',
  null,
  'Рады видеть вас! Оцените нас — это займёт 10 секунд ☕',
  'https://yandex.ru/maps',
  'https://maps.google.com',
  'https://2gis.ru',
  'https://example.com/menu.pdf',
  'Coffee_DEMO',
  'lovecoffee2024',
  'https://instagram.com',
  'https://t.me/telegram',
  '+7 900 000-00-00',
  'г. Москва, ул. Примерная, 1',
  null,
  '#2563eb'
)
on conflict (slug) do nothing;
