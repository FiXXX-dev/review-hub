-- Такси-форма и каталог услуг с ценами (вместо блоков-ссылок)

-- ─── venues: классы такси ─────────────────────────────────
alter table public.venues
  add column if not exists taxi_classes jsonb;  -- null = ["Эконом","Комфорт","Минивэн"]

-- ─── taxi_requests ────────────────────────────────────────
create table if not exists public.taxi_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  room text,
  destination text not null,
  car_class text,
  when_time text,          -- null = "Сейчас", иначе время ("15:30")
  comment text,
  created_at timestamptz not null default now()
);

alter table public.taxi_requests enable row level security;

drop policy if exists "anon can insert taxi_requests" on public.taxi_requests;
create policy "anon can insert taxi_requests"
  on public.taxi_requests for insert
  to anon
  with check (true);

drop policy if exists "auth read taxi_requests" on public.taxi_requests;
create policy "auth read taxi_requests"
  on public.taxi_requests for select
  to authenticated
  using (true);

-- ─── services: каталог услуг заведения ────────────────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title_ru text not null,
  title_uz text,
  price numeric,
  is_free boolean not null default false,
  require_comment boolean not null default false,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;

-- ВНИМАНИЕ: /admin/services/:slug пока без авторизации (по требованию),
-- поэтому anon имеет полный CRUD. Когда добавим auth на эту страницу —
-- удалить anon-политики записи и оставить только select.
drop policy if exists "anon read services" on public.services;
create policy "anon read services"
  on public.services for select
  to anon, authenticated
  using (true);

drop policy if exists "anon write services" on public.services;
create policy "anon write services"
  on public.services for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon update services" on public.services;
create policy "anon update services"
  on public.services for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon delete services" on public.services;
create policy "anon delete services"
  on public.services for delete
  to anon, authenticated
  using (true);

-- ─── service_requests: время к заказу услуги ──────────────
alter table public.service_requests
  add column if not exists preferred_time text;

-- ─── пресет hotel: каталог услуг вместо плиток service ────
insert into public.presets (key, name, blocks, default_theme) values
(
  'hotel', 'Отель',
  '[
    {"type":"wifi","label_ru":"Wi-Fi","label_uz":"Wi-Fi","icon":"📶"},
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"services","label_ru":"Услуги отеля","label_uz":"Mehmonxona xizmatlari","icon":"🛎️"},
    {"type":"taxi","label_ru":"Вызвать такси","label_uz":"Taksi chaqirish","icon":"🚕"},
    {"type":"info","label_ru":"Информация об отеле","label_uz":"Mehmonxona haqida","icon":"ℹ️"},
    {"type":"contacts","label_ru":"Контакты","label_uz":"Kontaktlar","icon":"📍"}
  ]'::jsonb,
  '#1e40af'
)
on conflict (key) do update set
  name = excluded.name,
  blocks = excluded.blocks,
  default_theme = excluded.default_theme;

-- ─── сид услуг для каждого отеля без своего каталога ──────
insert into public.services (venue_id, title_ru, title_uz, price, is_free, require_comment, icon, sort_order)
select v.id, s.title_ru, s.title_uz, s.price, s.is_free, s.require_comment, s.icon, s.sort_order
from public.venues v
cross join (values
  ('Уборка номера',      'Xonani tozalash',      null::numeric, true,  false, '🧹', 1),
  ('Свежие полотенца',   'Yangi sochiqlar',      null,          true,  false, '🛏️', 2),
  ('Питьевая вода',      'Ichimlik suvi',        null,          true,  false, '💧', 3),
  ('Завтрак в номер',    'Xonaga nonushta',      60000,         false, false, '☕', 4),
  ('Прачечная',          'Kir yuvish',           40000,         false, false, '👕', 5),
  ('Поздний выезд',      'Kech chiqish',         100000,        false, false, '🕐', 6),
  ('Что-то сломалось',   'Nimadir buzildi',      null,          true,  true,  '🔧', 7)
) as s(title_ru, title_uz, price, is_free, require_comment, icon, sort_order)
where v.preset_key = 'hotel'
  and not exists (select 1 from public.services x where x.venue_id = v.id);
