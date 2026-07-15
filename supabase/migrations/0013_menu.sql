-- Структурированное меню: секции → категории → позиции.
-- Публичная страница читает активные строки (anon), управление —
-- через бэкенд кабинета (service role) или суперадмина (authenticated).

create table if not exists public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title_ru text not null,
  title_uz text,
  title_en text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  section_id uuid references public.menu_sections (id) on delete cascade,
  title_ru text not null,
  title_uz text,
  title_en text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete cascade,
  title_ru text not null,
  title_uz text,
  title_en text,
  description_ru text,
  description_uz text,
  description_en text,
  price numeric,
  weight_value numeric,
  weight_unit text,
  kbju jsonb,                         -- {calories, protein, fat, carbs}
  photo_url text,
  is_new boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_categories_section_idx on public.menu_categories (section_id);
create index if not exists menu_items_category_idx on public.menu_items (category_id);
create index if not exists menu_items_venue_idx on public.menu_items (venue_id);

alter table public.menu_sections enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- anon: видит только активные строки (управление — service role/суперадмин)
do $$
declare t text;
begin
  foreach t in array array['menu_sections','menu_categories','menu_items'] loop
    execute format('drop policy if exists "anon read active %1$s" on public.%1$s', t);
    execute format(
      'create policy "anon read active %1$s" on public.%1$s for select to anon using (is_active)', t);
    execute format('drop policy if exists "auth manage %1$s" on public.%1$s', t);
    execute format(
      'create policy "auth manage %1$s" on public.%1$s for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
