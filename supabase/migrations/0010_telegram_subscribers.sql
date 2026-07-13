-- Единый Telegram-бот halo: подписчики заведения вместо одного chat_id

-- ─── venue_subscribers ────────────────────────────────────
create table if not exists public.venue_subscribers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  chat_id text not null,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  is_active boolean not null default true,   -- false = отписался или заблокировал бота
  created_at timestamptz not null default now(),
  unique (venue_id, chat_id)
);

alter table public.venue_subscribers enable row level security;

-- пишет только service role (бот/бэкенд); админка может смотреть список
drop policy if exists "auth read subscribers" on public.venue_subscribers;
create policy "auth read subscribers"
  on public.venue_subscribers for select
  to authenticated
  using (true);

-- ─── pairing_code ─────────────────────────────────────────
alter table public.venues
  add column if not exists pairing_code text unique;

create or replace function public.gen_pairing_code(p_slug text)
returns text
language plpgsql
as $$
declare
  prefix text;
  code text;
begin
  prefix := upper(regexp_replace(coalesce(p_slug, ''), '[^a-zA-Z]', '', 'g'));
  prefix := rpad(substr(prefix, 1, 3), 3, 'X');
  loop
    code := prefix || '-' || lpad(floor(random() * 10000)::text, 4, '0');
    exit when not exists (select 1 from public.venues where pairing_code = code);
  end loop;
  return code;
end;
$$;

update public.venues
  set pairing_code = public.gen_pairing_code(slug)
  where pairing_code is null;

create or replace function public.venues_fill_pairing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pairing_code is null then
    new.pairing_code := public.gen_pairing_code(new.slug);
  end if;
  return new;
end;
$$;

drop trigger if exists venues_fill_pairing on public.venues;
create trigger venues_fill_pairing
  before insert on public.venues
  for each row
  execute function public.venues_fill_pairing();

-- pairing_code не должен быть виден анонимно (иначе любой подпишется на
-- чужие уведомления): колонковые гранты — anon видит только публичные поля.
revoke select on table public.venues from anon;
grant select (
  id, slug, name, logo_url, welcome_text,
  yandex_review_url, google_review_url, gis2_review_url,
  menu_url, wifi_ssid, wifi_password,
  instagram_url, telegram_url, phone, address,
  accent_color, text_color, background_image_url,
  preset_key, enabled_blocks, block_links,
  service_options, rating_platform_order, taxi_classes,
  created_at
) on table public.venues to anon;

-- ─── переносим владельцев и убираем owner_telegram_chat_id ─
insert into public.venue_subscribers (venue_id, chat_id, role)
select id, owner_telegram_chat_id, 'owner'
from public.venues
where owner_telegram_chat_id is not null and owner_telegram_chat_id <> ''
on conflict (venue_id, chat_id) do nothing;

alter table public.venues drop column if exists owner_telegram_chat_id;
