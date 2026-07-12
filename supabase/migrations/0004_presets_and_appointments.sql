-- Пресеты по вертикалям + записи (appointments)

-- ─── presets ──────────────────────────────────────────────
create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  blocks jsonb not null default '[]'::jsonb,
  default_theme text,
  created_at timestamptz not null default now()
);

alter table public.presets enable row level security;

drop policy if exists "anon can read presets" on public.presets;
create policy "anon can read presets"
  on public.presets for select
  to anon, authenticated
  using (true);

-- ─── seed presets (перезапускаемо) ────────────────────────
insert into public.presets (key, name, blocks, default_theme) values
(
  'restaurant', 'Ресторан / кафе',
  '[
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"menu","label_ru":"Меню","label_uz":"Menyu","icon":"📖"},
    {"type":"wifi","label_ru":"Wi-Fi","label_uz":"Wi-Fi","icon":"📶"},
    {"type":"instagram","label_ru":"Instagram","label_uz":"Instagram","icon":"📷"},
    {"type":"telegram","label_ru":"Telegram","label_uz":"Telegram","icon":"✈️"},
    {"type":"contacts","label_ru":"Контакты","label_uz":"Kontaktlar","icon":"📍"}
  ]'::jsonb,
  '#c2410c'
),
(
  'clinic', 'Клиника',
  '[
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"price","label_ru":"Цены на услуги","label_uz":"Narxlar","icon":"💰"},
    {"type":"doctors","label_ru":"Наши врачи","label_uz":"Shifokorlarimiz","icon":"🩺"},
    {"type":"appointment","label_ru":"Записаться на приём","label_uz":"Qabulga yozilish","icon":"📅"},
    {"type":"contacts","label_ru":"Контакты","label_uz":"Kontaktlar","icon":"📍"}
  ]'::jsonb,
  '#0e7490'
),
(
  'hotel', 'Отель',
  '[
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"wifi","label_ru":"Wi-Fi","label_uz":"Wi-Fi","icon":"📶"},
    {"type":"services","label_ru":"Услуги отеля","label_uz":"Mehmonxona xizmatlari","icon":"🛎️"},
    {"type":"taxi","label_ru":"Вызвать такси","label_uz":"Taksi chaqirish","icon":"🚕"},
    {"type":"contacts","label_ru":"Контакты","label_uz":"Kontaktlar","icon":"📍"}
  ]'::jsonb,
  '#1e40af'
),
(
  'salon', 'Салон красоты',
  '[
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"appointment","label_ru":"Записаться","label_uz":"Yozilish","icon":"📅"},
    {"type":"price","label_ru":"Прайс","label_uz":"Narxlar","icon":"💰"},
    {"type":"instagram","label_ru":"Instagram","label_uz":"Instagram","icon":"📷"},
    {"type":"masters","label_ru":"Наши мастера","label_uz":"Ustalarimiz","icon":"💇"}
  ]'::jsonb,
  '#be185d'
),
(
  'shop', 'Магазин',
  '[
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"catalog","label_ru":"Каталог","label_uz":"Katalog","icon":"🛍️"},
    {"type":"telegram","label_ru":"Telegram","label_uz":"Telegram","icon":"✈️"},
    {"type":"instagram","label_ru":"Instagram","label_uz":"Instagram","icon":"📷"},
    {"type":"contacts","label_ru":"Контакты","label_uz":"Kontaktlar","icon":"📍"}
  ]'::jsonb,
  '#7c3aed'
),
(
  'auto', 'Автосервис',
  '[
    {"type":"rating","label_ru":"Оценить нас","label_uz":"Bizni baholang","icon":"⭐"},
    {"type":"price","label_ru":"Прайс","label_uz":"Narxlar","icon":"💰"},
    {"type":"appointment","label_ru":"Записаться","label_uz":"Yozilish","icon":"📅"},
    {"type":"phone","label_ru":"Позвонить","label_uz":"Qo''ng''iroq qilish","icon":"📞"}
  ]'::jsonb,
  '#334155'
)
on conflict (key) do update set
  name = excluded.name,
  blocks = excluded.blocks,
  default_theme = excluded.default_theme;

-- ─── venues: preset_key + block_links ─────────────────────
alter table public.venues
  add column if not exists preset_key text references public.presets (key),
  add column if not exists block_links jsonb not null default '{}'::jsonb;

-- при создании заведения enabled_blocks заполняется из пресета
-- (остаётся редактируемым — это просто дефолт)
create or replace function public.venues_fill_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled_blocks is null and new.preset_key is not null then
    select array(
      select b ->> 'type'
      from jsonb_array_elements(p.blocks) as b
    )
    into new.enabled_blocks
    from presets p
    where p.key = new.preset_key;
  end if;
  return new;
end;
$$;

drop trigger if exists venues_fill_blocks on public.venues;
create trigger venues_fill_blocks
  before insert on public.venues
  for each row
  execute function public.venues_fill_blocks();

-- Bon! — ресторан
update public.venues set preset_key = 'restaurant' where slug = 'bon';

-- ─── appointments ─────────────────────────────────────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  phone text not null,
  service text,
  preferred_time text,
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

drop policy if exists "anon can insert appointments" on public.appointments;
create policy "anon can insert appointments"
  on public.appointments for insert
  to anon
  with check (true);

drop policy if exists "auth read appointments" on public.appointments;
create policy "auth read appointments"
  on public.appointments for select
  to authenticated
  using (true);
