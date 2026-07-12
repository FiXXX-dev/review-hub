import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

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

const app = express()
app.use(express.json())

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    console.error('Telegram sendMessage failed:', res.status, await res.text())
  }
}

app.post('/api/notify', async (req, res) => {
  try {
    const { venue_id, rating_id, stars, message, contact, platform } = req.body || {}

    const starsNum = Number(stars)
    if (!venue_id || !Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
      return res.status(400).json({ error: 'venue_id and stars (1-5) are required' })
    }
    if (platform && !PLATFORM_NAMES[platform]) {
      return res.status(400).json({ error: 'unknown platform' })
    }
    if (!platform && (typeof message !== 'string' || !message.trim())) {
      return res.status(400).json({ error: 'message is required for feedback notifications' })
    }
    if (!supabase) {
      return res.status(503).json({ error: 'supabase is not configured on the server' })
    }

    const { data: venue, error } = await supabase
      .from('venues')
      .select('id, name, owner_telegram_chat_id')
      .eq('id', venue_id)
      .maybeSingle()
    if (error || !venue) {
      return res.status(404).json({ error: 'venue not found' })
    }

    // redirected_to обновляется здесь, потому что anon по RLS не имеет update на ratings
    if (platform && rating_id) {
      await supabase.from('ratings').update({ redirected_to: platform }).eq('id', rating_id)
    }

    const text = platform
      ? `✅ ${starsNum}⭐ — посетитель ушёл оставлять отзыв на ${PLATFORM_NAMES[platform]}`
      : `⚠️ Оценка ${starsNum}⭐ — ${venue.name}\n\n"${message.trim().slice(0, 2000)}"\n\nКонтакт: ${
          (contact && String(contact).trim().slice(0, 200)) || 'не оставлен'
        }`

    // нет chat_id — данные уже в базе, просто выходим без ошибки
    if (venue.owner_telegram_chat_id) {
      await sendTelegram(venue.owner_telegram_chat_id, text)
    }

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
