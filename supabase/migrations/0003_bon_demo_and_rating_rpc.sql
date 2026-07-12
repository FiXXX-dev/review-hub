-- 1) enabled_blocks: какие блоки показывать на странице заведения.
--    null = показывать всё (по наличию данных), массив = только перечисленные.
alter table public.venues
  add column if not exists enabled_blocks text[];

-- 2) RPC для анонимных посетителей: у anon по RLS нет update на ratings,
--    поэтому смена звёзд и проставление redirected_to идут через
--    security definer функции с жёсткими ограничениями (только свежие
--    строки, только валидные значения, только ещё не редиректнутые).
create or replace function public.rating_set_stars(p_rating_id uuid, p_stars int)
returns void
language sql
security definer
set search_path = public
as $$
  update ratings
  set stars = p_stars
  where id = p_rating_id
    and p_stars between 1 and 5
    and redirected_to is null
    and created_at > now() - interval '1 hour';
$$;

create or replace function public.rating_set_redirect(p_rating_id uuid, p_platform text)
returns void
language sql
security definer
set search_path = public
as $$
  update ratings
  set redirected_to = p_platform
  where id = p_rating_id
    and p_platform in ('yandex', 'google', '2gis')
    and redirected_to is null
    and created_at > now() - interval '1 hour';
$$;

grant execute on function public.rating_set_stars(uuid, int) to anon, authenticated;
grant execute on function public.rating_set_redirect(uuid, text) to anon, authenticated;

-- 3) Демо-заведение Bon! (Ташкент). Перезапускаемо: при конфликте по slug
--    обновляются только брендовые поля — ссылки, заполненные вручную
--    в Supabase, повторный запуск НЕ затирает.
insert into public.venues (
  slug, name, welcome_text, accent_color,
  yandex_review_url, google_review_url, gis2_review_url,
  menu_url, instagram_url, wifi_ssid, wifi_password,
  enabled_blocks
) values (
  'bon',
  'Bon!',
  'Спасибо, что зашли к нам',
  '#6B2737',
  '', '', '',
  '', '', '', '',
  array['rating', 'menu', 'wifi', 'instagram']
)
on conflict (slug) do update set
  name = excluded.name,
  welcome_text = excluded.welcome_text,
  accent_color = excluded.accent_color,
  enabled_blocks = excluded.enabled_blocks;

-- owner_telegram_chat_id заполняется отдельно (из env DEMO_CHAT_ID —
-- см. scripts/seed-bon.mjs, либо руками):
-- update public.venues set owner_telegram_chat_id = '<DEMO_CHAT_ID>' where slug = 'bon';
