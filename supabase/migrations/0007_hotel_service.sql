-- Вертикаль отелей: обслуживание номера (service), номер комнаты,
-- порядок платформ отзывов, link-блок info.

-- ─── venues: настройки сервиса и порядка платформ ─────────
alter table public.venues
  add column if not exists service_options jsonb,          -- null = все запросы включены
  add column if not exists rating_platform_order jsonb
    default '["yandex","google","2gis"]'::jsonb;

-- ─── номер комнаты в заявках и оценках ────────────────────
alter table public.ratings add column if not exists room text;
alter table public.feedback add column if not exists room text;
alter table public.appointments add column if not exists room text;

-- ─── service_requests ─────────────────────────────────────
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  room text not null,
  request_type text not null,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

drop policy if exists "anon can insert service_requests" on public.service_requests;
create policy "anon can insert service_requests"
  on public.service_requests for insert
  to anon
  with check (true);

drop policy if exists "auth read service_requests" on public.service_requests;
create policy "auth read service_requests"
  on public.service_requests for select
  to authenticated
  using (true);

-- ─── пресет hotel: новый состав блоков ────────────────────
-- wifi первым (гости первым делом ищут интернет), rating обязателен,
-- service — обслуживание номера, info — link-блок с инфо об отеле.
insert into public.presets (key, name, blocks, default_theme) values
(
  'hotel', 'Отель',
  '[
    {"type":"wifi","label_ru":"Wi-Fi","label_uz":"Wi-Fi","icon":"📶"},
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"service","label_ru":"Обслуживание номера","label_uz":"Xona xizmati","icon":"🛎️"},
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

-- у отелей Google первым: гости — туристы
update public.venues
  set rating_platform_order = '["google","yandex","2gis"]'::jsonb
  where preset_key = 'hotel';
