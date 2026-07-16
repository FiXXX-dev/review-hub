-- Роль официанта + заказы за столами (упрощённый POS).

-- ── роль 'waiter' в user_roles ──
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check check (role in ('owner', 'staff', 'waiter'));

-- ── заказы ──
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  table_number int not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  waiter_id text,                       -- telegram_chat_id официанта, открывшего счёт
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  title_snapshot text not null,         -- фиксируем на момент заказа
  price_snapshot numeric not null default 0,
  qty int not null default 1,
  created_at timestamptz not null default now()
);

-- один открытый счёт на стол
create unique index if not exists orders_one_open_per_table
  on public.orders (venue_id, table_number) where status = 'open';
create index if not exists orders_venue_status_idx on public.orders (venue_id, status);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Управление — только через бэкенд (service role). Ни anon, ни authenticated.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
