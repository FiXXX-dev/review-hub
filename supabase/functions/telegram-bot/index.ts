// Telegram-бот halo: webhook для привязки к заведению + сбор номера для кабинета.
//
// Деплой: Supabase Dashboard → Edge Functions → telegram-bot
// (ВЫКЛЮЧИ "Enforce JWT verification" — Telegram шлёт запросы без токена!)
// Секреты: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

async function tg(method: string, body: unknown) {
  if (!TOKEN) return null
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`${method} failed:`, res.status, await res.text())
  return res
}

async function send(chatId: string | number, text: string, replyMarkup?: unknown) {
  await tg('sendMessage', {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

// Постоянные кнопки команд (показываем подключённым).
const MAIN_KB = {
  keyboard: [[{ text: '📊 Статистика' }, { text: '🔕 Отписаться' }]],
  resize_keyboard: true,
}
// Кнопка «Поделиться номером» — для входа в кабинет (вход по телефону).
const CONTACT_KB = {
  keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}
const REMOVE_KB = { remove_keyboard: true }

const HELP =
  'Введите код заведения (например, ABI-4821) — его выдаёт владелец в админке halo.\n\n' +
  'Команды:\n/stats — сводка по заведению\n/stop — отписаться от уведомлений'

async function hasSub(chatId: string) {
  const { count } = await supabase
    .from('venue_subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('is_active', true)
  return !!count
}

// пользователь нажал «Поделиться номером» → сохраняем телефон
async function saveContact(chatId: string, msg: Record<string, unknown>) {
  const contact = msg.contact as { phone_number?: string; user_id?: number } | undefined
  const from = msg.from as { id?: number } | undefined
  if (!contact?.phone_number) return
  if (contact.user_id && from?.id && contact.user_id !== from.id) {
    await send(chatId, 'Отправьте, пожалуйста, свой номер кнопкой ниже, а не чужой контакт.', CONTACT_KB)
    return
  }
  const phone = contact.phone_number
  await supabase.from('venue_subscribers').update({ phone }).eq('chat_id', chatId)
  await supabase.from('user_roles').update({ phone }).eq('telegram_chat_id', chatId)
  await send(
    chatId,
    'Спасибо! Номер сохранён. Теперь вы сможете войти в кабинет halo по этому номеру.',
    MAIN_KB,
  )
}

async function pair(chatId: string, rawCode: string) {
  const m = rawCode.toUpperCase().replace(/\s+/g, '').match(/^([A-Z]{2,4})-?(\d{3,5})$/)
  if (!m) return false
  const code = `${m[1]}-${m[2]}`
  const { data: venue } = await supabase
    .from('venues').select('id, name').eq('pairing_code', code).maybeSingle()
  if (!venue) {
    await send(chatId, `Код ${code} не найден. Проверьте код у владельца заведения.`)
    return true
  }
  const { count } = await supabase
    .from('venue_subscribers').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id)
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
    `Готово! Вы подключены к ${venue.name}. Сюда будут приходить отзывы и заявки.`,
    MAIN_KB,
  )
  // просим номер — по нему владелец входит в кабинет halo
  await send(
    chatId,
    'Чтобы входить в кабинет halo, поделитесь своим номером телефона — нажмите «📱 Поделиться номером» ниже.',
    CONTACT_KB,
  )
  return true
}

async function stop(chatId: string) {
  const { data } = await supabase
    .from('venue_subscribers').update({ is_active: false })
    .eq('chat_id', chatId).eq('is_active', true).select('venue_id')
  await send(
    chatId,
    data?.length
      ? 'Вы отписаны от уведомлений. Чтобы подключиться снова — введите код заведения.'
      : 'Активных подписок нет. Чтобы подключиться — введите код заведения.',
    REMOVE_KB,
  )
}

// /stats: одно заведение — сразу сводка; несколько — кнопки выбора
async function statsMenu(chatId: string) {
  const { data: subs } = await supabase
    .from('venue_subscribers').select('venue_id, venue:venues(id, name)')
    .eq('chat_id', chatId).eq('is_active', true)
  if (!subs?.length) {
    await send(chatId, 'Вы не подключены ни к одному заведению. Введите код заведения.')
    return
  }
  if (subs.length === 1) {
    await statsForVenue(chatId, subs[0].venue_id)
    return
  }
  const inline_keyboard = subs.map((s) => [{
    text: (s as { venue?: { name?: string } }).venue?.name ?? 'Заведение',
    callback_data: `stats:${s.venue_id}`,
  }])
  await send(chatId, 'Выберите заведение для сводки:', { inline_keyboard })
}

async function statsForVenue(chatId: string, vid: string) {
  // доступ есть только к своим заведениям
  const { count: allowed } = await supabase
    .from('venue_subscribers').select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId).eq('venue_id', vid).eq('is_active', true)
  if (!allowed) {
    await send(chatId, 'Нет доступа к этому заведению.')
    return
  }
  const { data: venue } = await supabase.from('venues').select('name').eq('id', vid).maybeSingle()
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
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
  await send(
    chatId,
    `📊 ${venue?.name ?? 'Заведение'} — за 7 дней\n\n` +
      `Сканов: ${scans.count ?? 0}\n` +
      `Оценок: ${stars.length} (средняя ${avg}⭐)\n` +
      `Негатива перехвачено: ${feedback.count ?? 0}\n` +
      `Заявок: ${requests} (обслуживание ${services.count ?? 0} · такси ${taxi.count ?? 0} · записи ${appts.count ?? 0})`,
  )
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  try {
    const update = await req.json()

    // нажатие inline-кнопки (выбор заведения в /stats)
    const cb = update?.callback_query
    if (cb) {
      const cbChat = cb.message?.chat?.id != null ? String(cb.message.chat.id) : null
      const data = String(cb.data || '')
      await tg('answerCallbackQuery', { callback_query_id: cb.id })
      if (cbChat && data.startsWith('stats:')) {
        await statsForVenue(cbChat, data.slice(6))
      }
      return Response.json({ ok: true })
    }

    const msg = update?.message
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null
    if (!chatId) return Response.json({ ok: true })

    // пользователь поделился контактом
    if (msg?.contact) {
      await saveContact(chatId, msg)
      return Response.json({ ok: true })
    }

    const text = typeof msg?.text === 'string' ? msg.text.trim() : ''
    if (!text) return Response.json({ ok: true })

    if (text.startsWith('/start')) {
      // на старте номер НЕ просим — только показываем кнопки, если уже подключён
      const kb = (await hasSub(chatId)) ? MAIN_KB : REMOVE_KB
      await send(chatId, `Привет! Это бот halo — уведомления об отзывах и заявках вашего заведения.\n\n${HELP}`, kb)
    } else if (text.startsWith('/stop') || text === '🔕 Отписаться') {
      await stop(chatId)
    } else if (text.startsWith('/stats') || text === '📊 Статистика') {
      await statsMenu(chatId)
    } else if (!(await pair(chatId, text))) {
      await send(chatId, `Не понял 🤔\n\n${HELP}`)
    }
  } catch (err) {
    console.error('telegram-bot error:', err)
  }
  return Response.json({ ok: true })
})
