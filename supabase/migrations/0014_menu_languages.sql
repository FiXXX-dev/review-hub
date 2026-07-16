-- Набор языков меню на выбор заведения + турецкий язык для контента меню.
-- menu_languages: jsonb-массив кодов вроде ["ru","tr","en"]. NULL = дефолт
-- (ru/uz/en), чтобы уже существующие заведения не сломались.

alter table public.venues
  add column if not exists menu_languages jsonb;

alter table public.menu_sections   add column if not exists title_tr text;
alter table public.menu_categories add column if not exists title_tr text;
alter table public.menu_items       add column if not exists title_tr text;
alter table public.menu_items       add column if not exists description_tr text;
