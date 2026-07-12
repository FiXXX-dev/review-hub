# halo

Страница заведения для QR/NFC: посетитель оценивает заведение, оценки 4–5⭐ уходят на Яндекс.Карты / Google / 2ГИС, оценки 1–3⭐ перехватываются в приватную форму, и текст отправляется владельцу в Telegram. Плюс меню, Wi-Fi пароль и соцсети.

MVP: страница заведения + админка на /admin (вход через Supabase Auth) для управления заведениями и просмотра статистики.

## Стек

- **Frontend**: React + Vite, mobile-first SPA
- **Backend**: Express (раздаёт собранный фронт + `POST /api/notify` для Telegram)
- **База**: Supabase (Postgres, RLS)
- **Деплой**: Railway (один сервис)

## Запуск локально

```bash
npm install
cp .env.example .env   # заполнить ключи
npm run dev            # фронт на :5173, /api проксируется на :3000
npm start              # backend на :3000 (в другом терминале, нужен npm run build для статики)
```

Страница заведения: `http://localhost:5173/v/demo`

## Настройка Supabase

1. Создать проект на [supabase.com](https://supabase.com).
2. Выполнить `supabase/migrations/0001_reviewhub.sql` в SQL Editor — создаст таблицы `venues`, `ratings`, `feedback`, `scans`, включит RLS и добавит демо-заведение со slug `demo`.
3. Взять `URL` и `anon key` из Settings → API (для фронта), `service_role key` — для бэкенда.

RLS: anon может читать `venues` и вставлять в `ratings` / `feedback` / `scans`. Обновление `ratings.redirected_to` делает бэкенд сервисным ключом.

## Настройка Telegram

1. Создать бота через [@BotFather](https://t.me/BotFather), взять токен → `TELEGRAM_BOT_TOKEN`.
2. Владелец заведения пишет боту `/start` (иначе бот не сможет отправить ему сообщение).
3. Узнать chat_id владельца (например, через `https://api.telegram.org/bot<TOKEN>/getUpdates`) и записать его в `venues.owner_telegram_chat_id`.
4. Если `owner_telegram_chat_id` пуст — фидбэк просто сохраняется в базе, ничего не падает.

## Деплой на Railway

1. New Project → Deploy from GitHub repo (`review-hub`).
2. Variables:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — попадают в сборку фронта
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — для бэкенда
   - `TELEGRAM_BOT_TOKEN`
3. Railway соберёт (`npm ci && npm run build`) и запустит (`npm start`) по `railway.json`.
4. Settings → Networking → Generate Domain — публичный URL. Страница: `https://<domain>/v/demo`.

## API

`POST /api/notify`

- Негативный фидбэк (1–3⭐): `{ venue_id, stars, message, contact? }` → владельцу уходит «⚠️ Оценка N⭐ …».
- Хорошая оценка (4–5⭐): `{ venue_id, rating_id, stars, platform }` (`yandex` | `google` | `2gis`) → обновляет `ratings.redirected_to` и шлёт владельцу «✅ N⭐ — посетитель ушёл оставлять отзыв…».

## Статистика

Дашборда нет (MVP) — данные копятся в `scans` и `ratings`:

```sql
-- сканы по дням
select date_trunc('day', created_at) d, count(*) from scans group by 1 order by 1 desc;

-- распределение оценок и конверсия в переход
select stars, count(*) total, count(redirected_to) redirected from ratings group by 1 order by 1;
```

## Пресеты по вертикалям

Таблица `presets` (`restaurant`, `clinic`, `hotel`, `salon`, `shop`, `auto`) описывает набор блоков страницы: `{ type, label_ru, label_uz, icon }` + `default_theme`. У заведения есть `preset_key`; при создании `enabled_blocks` заполняется из пресета (триггер в базе + предзаполнение в админке), дальше блоки можно включать/выключать вручную. Страница `/v/:slug` одна для всех вертикалей — рендерит блоки из `enabled_blocks`.

Типы блоков: `rating` (ядро, всегда первый), `wifi`, `appointment` (форма записи → таблица `appointments` + Telegram), `contacts`, `phone`, `instagram`/`telegram`, и универсальные link-блоки (`menu`, `price`, `catalog`, `doctors`, `masters`, `services`, `taxi`) — URL хранятся в `venues.block_links` (jsonb).
