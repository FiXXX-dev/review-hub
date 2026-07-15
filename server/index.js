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

app.use('/api/cabinet', createCabinetRouter({ supabase, sendTelegram: sendToChat }))

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

app.use(express.static(distDir))

// SPA fallback: /v/:slug и всё остальное отдаёт index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`halo listening on :${PORT}`)
})
