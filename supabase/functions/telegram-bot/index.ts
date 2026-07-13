// Telegram-бот halo: webhook для привязки сотрудников к заведению.
//
// Деплой: Supabase Dashboard → Edge Functions → New function 'telegram-bot'
// (ВЫКЛЮЧИ "Enforce JWT verification" — Telegram шлёт запросы без токена!)
// Секреты: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (любая случайная строка).
//
// Подключение webhook (один раз):
// curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//   -d "url=https://<project>.supabase.co/functions/v1/telegram-bot" \
//   -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

async function send(chatId: string | number, text: string) {
  if (!TOKEN) return
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) console.error('sendMessage failed:', res.status, await res.text())
}

const HELP =
  'Введите код заведения (например, ABI-4821) — его выдаёт владелец в админке halo.\n\n' +
  'Команды:\n/stats — сводка по заведению\n/stop — отписаться от уведомлений'

async function pair(chatId: string, rawCode: string) {
  const m = rawCode.toUpperCase().replace(/\s+/g, '').match(/^([A-Z]{2,4})-?(\d{3,5})$/)
  if (!m) return false
  const code = `${m[1]}-${m[2]}`
  const { data: venue } = await supabase
    .from('venues')
    .select('id, name')
    .eq('pairing_code', code)
    .maybeSingle()
  if (!venue) {
    await send(chatId, `Код ${code} не найден. Проверьте код у владельца заведения.`)
    return true
  }
  // первый подписчик заведения — владелец, остальные — персонал
  const { count } = await supabase
    .from('venue_subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('venue_id', venue.id)
  const { error } = await supabase
    .from('venue_subscribers')
    .upsert(
      { venue_id: venue.id, chat_id: chatId, is_active: true, role: count ? 'staff' : 'owner' },
      { onConflict: 'venue_id,chat_id' },
    )
  if (error) {
    console.error('pair upsert failed:', error)
    await send(chatId, 'Что-то пошло не так, попробуйте ещё раз.')
    return true
  }
  await send(
    chatId,
    `Готово! Вы подключены к ${venue.name}. Сюда будут приходить отзывы и заявки.\n\n/stats — сводка, /stop — отписаться`,
  )
  return true
}

async function stop(chatId: string) {
  const { data } = await supabase
    .from('venue_subscribers')
    .update({ is_active: false })
    .eq('chat_id', chatId)
    .eq('is_active', true)
    .select('venue_id')
  await send(
    chatId,
    data?.length
      ? 'Вы отписаны от уведомлений. Чтобы подключиться снова — введите код заведения.'
      : 'Активных подписок нет. Чтобы подключиться — введите код заведения.',
  )
}

async function stats(chatId: string) {
  const { data: subs } = await supabase
    .from('venue_subscribers')
    .select('venue_id, venue:venues(id, name)')
    .eq('chat_id', chatId)
    .eq('is_active', true)
  if (!subs?.length) {
    await send(chatId, 'Вы не подключены ни к одному заведению. Введите код заведения.')
    return
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  for (const sub of subs) {
    const vid = sub.venue_id
    const [scans, ratings, feedback, services, taxi, appts] = await Promise.all([
      supabase.from('scans').select('*', { count: 'exact', head: true }).eq('venue_id', vid).gte('created_at', weekAgo),
      supabase.from('ratings').select('stars').eq('venue_id', vid).gte('created_at', weekAgo),
      supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('venue_id', vid).gte('created_at', weekAgo),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('venue_id', vid).gte('created_at', weekAgo),
      supabase.from('taxi_requests').select('*', { count: 'exact', head: true }).eq('venue_id', vid).gte('created_at', weekAgo),
      supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('venue_id', vid).gte('created_at', weekAgo),
    ])
    const stars = (ratings.data ?? []).map((r) => r.stars)
    const avg = stars.length ? (stars.reduce((a, b) => a + b, 0) / stars.length).toFixed(1) : '—'
    const requests = (services.count ?? 0) + (taxi.count ?? 0) + (appts.count ?? 0)
    const name = (sub as { venue?: { name?: string } }).venue?.name ?? 'Заведение'
    await send(
      chatId,
      `📊 ${name} — за 7 дней\n\n` +
        `Сканов: ${scans.count ?? 0}\n` +
        `Оценок: ${stars.length} (средняя ${avg}⭐)\n` +
        `Негатива перехвачено: ${feedback.count ?? 0}\n` +
        `Заявок: ${requests} (обслуживание ${services.count ?? 0} · такси ${taxi.count ?? 0} · записи ${appts.count ?? 0})`,
    )
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  try {
    const update = await req.json()
    const msg = update?.message
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null
    const text = typeof msg?.text === 'string' ? msg.text.trim() : ''
    if (!chatId || !text) return Response.json({ ok: true })

    if (text.startsWith('/start')) {
      await send(chatId, `Привет! Это бот halo — уведомления об отзывах и заявках вашего заведения.\n\n${HELP}`)
    } else if (text.startsWith('/stop')) {
      await stop(chatId)
    } else if (text.startsWith('/stats')) {
      await stats(chatId)
    } else if (!(await pair(chatId, text))) {
      await send(chatId, `Не понял 🤔\n\n${HELP}`)
    }
  } catch (err) {
    console.error('telegram-bot error:', err)
  }
  // Telegram всегда получает 200, иначе он ретраит update бесконечно
  return Response.json({ ok: true })
})
