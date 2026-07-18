-- Модуль оплаты: редирект гостя на платёжный шлюз заведения.
-- Деньги идут напрямую заведению; halo их не обрабатывает и не хранит.
-- Подтверждение оплаты — ручное (официант/владелец). Вебхук можно добавить
-- позже, не меняя эти поля.

alter table public.venues add column if not exists payment_enabled boolean not null default false;
alter table public.venues add column if not exists payment_provider text
  check (payment_provider in ('payme', 'click', 'uzum', 'custom'));
alter table public.venues add column if not exists payment_merchant_id text; -- payme/click
alter table public.venues add column if not exists payment_custom_url text;   -- uzum/custom (готовая ссылка/шаблон)

alter table public.orders add column if not exists payment_status text not null default 'none'
  check (payment_status in ('none', 'awaiting', 'paid'));
alter table public.orders add column if not exists payment_marked_by text;     -- кто подтвердил (telegram_chat_id)
alter table public.orders add column if not exists payment_marked_at timestamptz;
