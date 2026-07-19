-- Takeaway (заказ навынос): схема. Полная изоляция от dine-in:
-- только новые колонки с дефолтами, ничего существующего не переименовано.
--
-- ДВА ОТКЛОНЕНИЯ ОТ ТЗ (по факту текущей схемы, оба согласованы с изоляцией):
-- 1) В orders НЕТ table_id — есть table_number int NOT NULL (0015).
--    Для takeaway снимаем NOT NULL; все dine-in запросы фильтруют
--    status='open'/'closed' и takeaway-строки не видят (аудит — в шаге 2).
-- 2) orders.status УЖЕ существует ('open'|'closed' у dine-in). Не меняем
--    его смысл и дефолт — расширяем CHECK статусами takeaway; заказ
--    навынос создаётся с явным status='created' при вставке.

-- ── venues ──
alter table public.venues add column if not exists mode text not null default 'dine_in';
alter table public.venues drop constraint if exists venues_mode_check;
alter table public.venues add constraint venues_mode_check
  check (mode in ('dine_in', 'takeaway', 'both'));

alter table public.venues add column if not exists queue_load int not null default 0; -- надбавка к времени, минут

-- ── menu_items ──
alter table public.menu_items add column if not exists prep_minutes int not null default 5;
alter table public.menu_items add column if not exists is_available boolean not null default true;

-- ── orders ──
alter table public.orders add column if not exists order_type text not null default 'dine_in';
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add constraint orders_order_type_check
  check (order_type in ('dine_in', 'takeaway'));

alter table public.orders add column if not exists pickup_code text;        -- 4 цифры
alter table public.orders add column if not exists guest_name text;
alter table public.orders add column if not exists paid_confirmed_at timestamptz; -- «гость сообщил, что оплатил»
alter table public.orders add column if not exists ready_at timestamptz;

-- статусы: dine-in ('open'|'closed') + takeaway
-- created → paid → accepted → preparing → ready → picked_up (+ cancelled из любого)
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'open', 'closed',                                            -- dine-in (как было)
    'created', 'paid', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled'
  ));

-- takeaway-заказ не привязан к столу
alter table public.orders alter column table_number drop not null;

-- код выдачи уникален в пределах дня и заведения
-- (timezone('UTC', ts) immutable — можно в индекс; ts::date — нельзя)
create unique index if not exists orders_pickup_code_day
  on public.orders (venue_id, pickup_code, (date(timezone('UTC', created_at))))
  where pickup_code is not null;

-- очередь баристы: выборка по типу и статусу
create index if not exists orders_takeaway_queue_idx
  on public.orders (venue_id, status)
  where order_type = 'takeaway';

-- RLS уже включён на orders/order_items (0015) без anon/auth-политик:
-- вся работа идёт через бэкенд (service role). Гость читает свой заказ
-- по id через /api (знание UUID = доступ), персонал/владелец — через
-- авторизованные ручки кабинета. Политики не добавляем.
