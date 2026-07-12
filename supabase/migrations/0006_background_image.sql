-- Фоновое изображение страницы + настраиваемый цвет текста

alter table public.venues
  add column if not exists background_image_url text,
  add column if not exists text_color text;

-- Bon!: кофейный фон (лежит в репо, раздаётся с Pages), тёплая палитра.
-- Относительный путь резолвится страницей от её базового URL, поэтому
-- переезд на свой домен ничего не сломает. Загруженный через админку
-- фон (Supabase Storage) хранится абсолютной ссылкой — тоже работает.
update public.venues set
  background_image_url = coalesce(background_image_url, 'bg/bon-coffee.webp'),
  accent_color = '#8B5E3C',
  text_color = '#3E2A20'
where slug = 'bon';
