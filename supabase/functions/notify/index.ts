// Supabase Edge Function: отправка Telegram-уведомлений владельцу заведения.
// Деплой: через Dashboard (Edge Functions → Deploy a new function, имя: notify)
// или `supabase functions deploy notify`.
// Секрет: TELEGRAM_BOT_TOKEN (Edge Functions → Secrets).
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY подставляются автоматически.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const PLATFORM_NAMES: Record<string, string> = {
  yandex: 'Яндекс.Картах',
  google: 'Google Картах',
  '2gis': '2ГИС',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const { venue_id, stars, message, contact, platform, type, name, phone, service, preferred_time } =
      await req.json()

    const isAppointment = type === 'appointment'
    const starsNum = Number(stars)
    if (!venue_id) return json({ error: 'venue_id is required' }, 400)
    if (isAppointment) {
      if (typeof name !== 'string' || !name.trim() || typeof phone !== 'string' || !phone.trim()) {
        return json({ error: 'name and phone are required for appointments' }, 400)
      }
    } else {
      if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
        return json({ error: 'stars (1-5) are required' }, 400)
      }
      if (platform && !PLATFORM_NAMES[platform]) {
        return json({ error: 'unknown platform' }, 400)
      }
      if (!platform && (typeof message !== 'string' || !message.trim())) {
        return json({ error: 'message is required for feedback notifications' }, 400)
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: venue, error } = await supabase
      .from('venues')
      .select('id, name, owner_telegram_chat_id')
      .eq('id', venue_id)
      .maybeSingle()
    if (error || !venue) return json({ error: 'venue not found' }, 404)

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
    // нет chat_id или токена — данные уже в базе, выходим без ошибки
    if (!venue.owner_telegram_chat_id || !token) return json({ ok: true, sent: false })

    const text = isAppointment
      ? `📅 Новая запись — ${venue.name}\n\nИмя: ${String(name).trim().slice(0, 200)}\nТелефон: ${String(phone).trim().slice(0, 100)}\nУслуга: ${
          (service && String(service).trim().slice(0, 200)) || 'не указана'
        }\nВремя: ${(preferred_time && String(preferred_time).trim().slice(0, 200)) || 'не указано'}`
      : platform
        ? `✅ ${starsNum}⭐ — посетитель ушёл оставлять отзыв на ${PLATFORM_NAMES[platform]}`
        : `⚠️ Оценка ${starsNum}⭐ — ${venue.name}\n\n"${String(message).trim().slice(0, 2000)}"\n\nКонтакт: ${
            (contact && String(contact).trim().slice(0, 200)) || 'не оставлен'
          }`

    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: venue.owner_telegram_chat_id, text }),
    })
    if (!tg.ok) console.error('telegram error:', tg.status, await tg.text())

    return json({ ok: true, sent: tg.ok })
  } catch (err) {
    console.error('notify error:', err)
    return json({ error: 'internal error' }, 500)
  }
})
