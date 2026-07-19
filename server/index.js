import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createCabinetRouter } from './cabinet.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const PORT = process.env.PORT || 3000
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null

const PLATFORM_NAMES = {
  yandex: 'Яндекс.Картах',
  google: 'Google Картах',
  '2gis': '2ГИС',
}

const SERVICE_LABELS = {
  cleaning: 'Уборка',
  towels: 'Полотенца / бельё',
  water: 'Вода',
  late_checkout: 'Поздний выезд',
  broken: 'Что-то сломалось',
  taxi: 'Вызвать такси',
}

// одиночная отправка (коды входа в кабинет). Возвращает true при успехе.
async function sendToChat(chatId, text) {
  if (!BOT_TOKEN) {
    console.error('sendToChat: TELEGRAM_BOT_TOKEN не задан')
    return false
  }
  if (!chatId) return false
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    console.error('sendToChat failed:', res.status, await res.text())
    return false
  }
  return true
}

const app = express()
app.use(express.json({ limit: '8mb' })) // base64-загрузки картинок в кабинете

app.use('/api/cabinet', createCabinetRouter({ supabase, sendTelegram: sendToChat, broadcast: broadcastTelegram }))

// ── гостевой счёт (read-only): смотрит тот же заказ, что вбил официант ──
app.get('/api/order', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'not configured' })
    const slug = String(req.query.slug || '')
    const table = parseInt(req.query.table, 10)
    if (!slug || !Number.isInteger(table)) return res.status(400).json({ error: 'bad request' })
    const { data: venue } = await supabase
      .from('venues')
      .select('id, name, accent_color, payment_enabled, payment_provider, payment_merchant_id, payment_custom_url')
      .eq('slug', slug).maybeSingle()
    if (!venue) return res.status(404).json({ error: 'venue not found' })
    // merchant_id/custom_url и так видны в платёжной ссылке — не секрет
    const vpub = {
      id: venue.id, name: venue.name, accent_color: venue.accent_color,
      payment_enabled: !!venue.payment_enabled,
      payment_provider: venue.payment_provider,
      payment_merchant_id: venue.payment_merchant_id,
      payment_custom_url: venue.payment_custom_url,
    }
    const { data: order } = await supabase
      .from('orders').select('id, created_at, payment_status')
      .eq('venue_id', venue.id).eq('table_number', table).eq('status', 'open').maybeSingle()
    if (!order) return res.json({ order: null, venue: vpub })
    const { data: items } = await supabase
      .from('order_items').select('title_snapshot, price_snapshot, qty').eq('order_id', order.id).order('created_at')
    const list = items ?? []
    const total = list.reduce((s, i) => s + Number(i.price_snapshot) * i.qty, 0)
    res.json({
      order: { id: order.id, items: list, total, created_at: order.created_at, payment_status: order.payment_status },
      venue: vpub,
    })
  } catch (err) {
    console.error('api/order error:', err)
    res.status(500).json({ error: 'internal' })
  }
})

// ── гость нажал «Оплатить онлайн» → ставим статус ожидания (не трогаем 'paid') ──
app.post('/api/pay-intent', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'not configured' })
    const slug = String(req.body?.slug || '')
    const table = parseInt(req.body?.table, 10)
    if (!slug || !Number.isInteger(table)) return res.status(400).json({ error: 'bad request' })
    const { data: venue } = await supabase.from('venues').select('id').eq('slug', slug).maybeSingle()
    if (!venue) return res.status(404).json({ error: 'venue not found' })
    await supabase
      .from('orders')
      .update({ payment_status: 'awaiting' })
      .eq('venue_id', venue.id).eq('table_number', table).eq('status', 'open').eq('payment_status', 'none')
    res.json({ ok: true })
  } catch (err) {
    console.error('pay-intent error:', err)
    res.status(500).json({ error: 'internal' })
  }
})

// ── гость зовёт официанта ──
app.post('/api/call-waiter', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'not configured' })
    const { venue_id, table_no } = req.body || {}
    if (!venue_id) return res.status(400).json({ error: 'venue_id required' })
    const t = table_no != null ? String(table_no).trim().slice(0, 20) : ''
    await broadcastTelegram(venue_id, `🙋 ${t ? `Стол ${t}` : 'Гость'} зовёт официанта`)
    res.json({ ok: true })
  } catch (err) {
    console.error('call-waiter error:', err)
    res.status(500).json({ error: 'internal' })
  }
})

// рассылка всем активным подписчикам заведения; 403 = пользователь
// заблокировал бота — подписка тихо деактивируется
async function broadcastTelegram(venueId, text) {
  if (!BOT_TOKEN || !supabase) return 0
  const { data: subs } = await supabase
    .from('venue_subscribers')
    .select('id, chat_id')
    .eq('venue_id', venueId)
    .eq('is_active', true)
  if (!subs?.length) return 0
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: s.chat_id, text }),
      })
      if (res.ok) {
        sent++
      } else if (res.status === 403) {
        await supabase.from('venue_subscribers').update({ is_active: false }).eq('id', s.id)
      } else {
        console.error('Telegram sendMessage failed:', res.status, await res.text())
      }
    })
  )
  return sent
}

app.post('/api/notify', async (req, res) => {
  try {
    const {
      venue_id, rating_id, stars, message, contact, platform, type,
      name, phone, service, preferred_time, room, request_type, comment, table_no,
      destination, car_class, when_time, price_label,
    } = req.body || {}

    const isAppointment = type === 'appointment'
    const isService = type === 'service'
    const isTaxi = type === 'taxi'
    const starsNum = Number(stars)
    if (!venue_id) {
      return res.status(400).json({ error: 'venue_id is required' })
    }
    if (isTaxi) {
      if (typeof destination !== 'string' || !destination.trim()) {
        return res.status(400).json({ error: 'destination is required for taxi' })
      }
    } else if (isService) {
      // request_type — либо известный ключ плиток, либо название услуги из каталога
      if (typeof room !== 'string' || !room.trim() || typeof request_type !== 'string' || !request_type.trim()) {
        return res.status(400).json({ error: 'room and request_type are required for service' })
      }
    } else if (isAppointment) {
      if (typeof name !== 'string' || !name.trim() || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ error: 'name and phone are required for appointments' })
      }
    } else {
      if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
        return res.status(400).json({ error: 'stars (1-5) are required' })
      }
      if (platform && !PLATFORM_NAMES[platform]) {
        return res.status(400).json({ error: 'unknown platform' })
      }
      if (!platform && (typeof message !== 'string' || !message.trim())) {
        return res.status(400).json({ error: 'message is required for feedback notifications' })
      }
    }
    if (!supabase) {
      return res.status(503).json({ error: 'supabase is not configured on the server' })
    }

    const { data: venue, error } = await supabase
      .from('venues')
      .select('id, name')
      .eq('id', venue_id)
      .maybeSingle()
    if (error || !venue) {
      return res.status(404).json({ error: 'venue not found' })
    }

    // redirected_to обновляется здесь, потому что anon по RLS не имеет update на ratings
    if (platform && rating_id) {
      await supabase.from('ratings').update({ redirected_to: platform }).eq('id', rating_id)
    }

    const roomNote = room && String(room).trim() ? `\nНомер: ${String(room).trim().slice(0, 20)}` : ''
    const tableNote = table_no && String(table_no).trim() ? `\nСтол: ${String(table_no).trim().slice(0, 20)}` : ''
    const clean = (v, n) => (v ? String(v).trim().slice(0, n) : '')
    const text = isTaxi
      ? `🚕 ${room ? `Номер ${clean(room, 20)} — такси` : 'Такси'}\nКуда: ${clean(destination, 300)}\nКласс: ${
          clean(car_class, 40) || 'любой'
        } · ${clean(when_time, 40) ? `к ${clean(when_time, 40)}` : 'сейчас'}${
          clean(comment, 500) ? `\n${clean(comment, 500)}` : ''
        }`
      : isService
        ? `🛎 Номер ${clean(room, 20)} — ${SERVICE_LABELS[request_type] || clean(request_type, 100)}${
            clean(price_label, 40) ? ` · ${clean(price_label, 40)}` : ''
          }${clean(preferred_time, 40) ? `\nК времени: ${clean(preferred_time, 40)}` : ''}${
            clean(comment, 500) ? `\n${clean(comment, 500)}` : ''
          }`
        : isAppointment
        ? `📅 Новая запись — ${venue.name}\n\nИмя: ${name.trim().slice(0, 200)}\nТелефон: ${phone.trim().slice(0, 100)}\nУслуга: ${
            (service && String(service).trim().slice(0, 200)) || 'не указана'
          }\nВремя: ${(preferred_time && String(preferred_time).trim().slice(0, 200)) || 'не указано'}${roomNote}${tableNote}`
        : platform
          ? `✅ ${starsNum}⭐ — посетитель ушёл оставлять отзыв на ${PLATFORM_NAMES[platform]}`
          : `⚠️ Оценка ${starsNum}⭐ — ${venue.name}\n\n"${message.trim().slice(0, 2000)}"\n\nКонтакт: ${
              (contact && String(contact).trim().slice(0, 200)) || 'не оставлен'
            }${roomNote}${tableNote}`

    // нет chat_id — данные уже в базе, просто выходим без ошибки
    await broadcastTelegram(venue.id, text)

    res.json({ ok: true })
  } catch (err) {
    console.error('notify error:', err)
    res.status(500).json({ error: 'internal error' })
  }
})

// Старые ссылки с ?table= (печатные QR) → канонический путь /v/:slug/t/:N.
// Настоящий 301, чтобы поисковики/мессенджеры переклеили URL; в SPA есть
// такой же клиентский фолбэк для хостингов без express.
app.get(['/v/:slug', '/v/:slug/bill', '/v/:slug/menu'], (req, res, next) => {
  const t = String(req.query.table || '').trim().slice(0, 20)
  if (!t) return next()
  const suffix = req.path.endsWith('/bill') ? '/bill' : req.path.endsWith('/menu') ? '/menu' : ''
  const rest = new URLSearchParams(req.query)
  rest.delete('table')
  const qs = rest.toString()
  res.redirect(301, `/v/${req.params.slug}/t/${encodeURIComponent(t)}${suffix}${qs ? `?${qs}` : ''}`)
})

app.use(express.static(distDir))

// SPA fallback: /v/:slug (включая /t/:table/...) и всё остальное отдаёт index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`halo listening on :${PORT}`)
})
