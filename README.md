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

## Telegram-бот halo

Один бот на всех клиентов. Уведомления (низкие оценки, заявки на обслуживание, такси, записи) рассылаются **всем активным подписчикам** заведения из `venue_subscribers` — владельцу, управляющему, ресепшену.

**Подключение сотрудника:** пишет боту `/start` → вводит код заведения (`venues.pairing_code`, вида `BON-4821`, показан в админке) → готово. `/stats` — сводка за 7 дней (сканы, средняя оценка, перехваченный негатив, заявки), `/stop` — отписка. Если пользователь заблокировал бота, подписка тихо деактивируется (`is_active = false`).

**Развёртывание бота (один раз):**

1. Создай бота у [@BotFather](https://t.me/BotFather), получи токен.
2. Supabase → Edge Functions → задеплой две функции из `supabase/functions/`:
   - `notify` — рассылка уведомлений со страницы;
   - `telegram-bot` — webhook бота (**выключи Enforce JWT verification** — Telegram шлёт запросы без токена).
3. Edge Functions → Secrets: `TELEGRAM_BOT_TOKEN` = токен, `TELEGRAM_WEBHOOK_SECRET` = любая случайная строка.
4. Подключи webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<project>.supabase.co/functions/v1/telegram-bot" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

`pairing_code` закрыт от анонимного чтения колонковыми грантами (миграция 0010) — публичная страница запрашивает явный список полей.

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

Типы блоков: `rating` (ядро, обязателен; позиция — из пресета), `wifi`, `appointment` (форма записи → `appointments` + Telegram), `service` (плитки быстрых запросов → `service_requests` + Telegram), `services` (каталог услуг с ценами из таблицы `services`, редактор — `/admin/services/:slug`; заказы → `service_requests`), `taxi` (форма вызова такси → `taxi_requests` + Telegram, классы — в `venues.taxi_classes`), `contacts`, `phone`, `instagram`/`telegram`, и универсальные link-блоки (`menu`, `price`, `catalog`, `doctors`, `masters`, `info`) — URL хранятся в `venues.block_links` (jsonb). Страница `/v/:slug?room=204` привязывает заявки и оценки к номеру комнаты; ссылки для всех номеров генерит `/admin/rooms/:slug`. Порядок платформ отзывов — `venues.rating_platform_order` (у отелей Google первым).

## Роли и кабинет владельца

- **`/admin`** — суперадмин (email/пароль Supabase): все заведения, техническая настройка, назначение владельцев (карточка «Владельцы и доступ» → chat_id + телефон + роль).
- **`/cabinet`** — кабинет владельца: вход по номеру телефона → бот halo присылает 4-значный код → сессия. Разделы: Профиль, Блоки (показать/скрыть + порядок), Столы (QR на каждый стол + «Скачать все QR PDF»). Доступ — только к своим заведениям из `user_roles`. Роль `staff` — только просмотр.

Кабинет ходит за данными через бэкенд (`/api/cabinet/*`), который проверяет доступ по `user_roles` сервисным ключом — владелец не получает ключей Supabase. Нужна переменная Railway **`CABINET_SESSION_SECRET`** (любая длинная случайная строка — подпись сессий). Гость: `gethalo.uz/v/:slug?table=N` привязывает стол ко всем заявкам/оценкам.
