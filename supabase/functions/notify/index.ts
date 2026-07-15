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

const SERVICE_LABELS: Record<string, string> = {
  cleaning: 'Уборка',
  towels: 'Полотенца / бельё',
  water: 'Вода',
  late_checkout: 'Поздний выезд',
  broken: 'Что-то сломалось',
  taxi: 'Вызвать такси',
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
    const {
      venue_id, stars, message, contact, platform, type,
      name, phone, service, preferred_time, room, request_type, comment, table_no,
      destination, car_class, when_time, price_label,
    } = await req.json()

    const isAppointment = type === 'appointment'
    const isService = type === 'service'
    const isTaxi = type === 'taxi'
    const starsNum = Number(stars)
    if (!venue_id) return json({ error: 'venue_id is required' }, 400)
    if (isTaxi) {
      if (typeof destination !== 'string' || !destination.trim()) {
        return json({ error: 'destination is required for taxi' }, 400)
      }
    } else if (isService) {
      // request_type — либо известный ключ плиток, либо название услуги из каталога
      if (typeof room !== 'string' || !room.trim() || typeof request_type !== 'string' || !request_type.trim()) {
        return json({ error: 'room and request_type are required for service' }, 400)
      }
    } else if (isAppointment) {
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
      .select('id, name')
      .eq('id', venue_id)
      .maybeSingle()
    if (error || !venue) return json({ error: 'venue not found' }, 404)

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
    // получатели — все активные подписчики заведения (бот halo, /start + код)
    const { data: subs } = await supabase
      .from('venue_subscribers')
      .select('id, chat_id')
      .eq('venue_id', venue.id)
      .eq('is_active', true)
    // нет подписчиков или токена — данные уже в базе, выходим без ошибки
    if (!token || !subs?.length) return json({ ok: true, sent: false })

    const roomNote = room && String(room).trim() ? `\nНомер: ${String(room).trim().slice(0, 20)}` : ''
    const tableNote = table_no && String(table_no).trim() ? `\nСтол: ${String(table_no).trim().slice(0, 20)}` : ''
    const clean = (v: unknown, n: number) => (v ? String(v).trim().slice(0, n) : '')
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
        ? `📅 Новая запись — ${venue.name}\n\nИмя: ${String(name).trim().slice(0, 200)}\nТелефон: ${String(phone).trim().slice(0, 100)}\nУслуга: ${
            (service && String(service).trim().slice(0, 200)) || 'не указана'
          }\nВремя: ${(preferred_time && String(preferred_time).trim().slice(0, 200)) || 'не указано'}${roomNote}${tableNote}`
        : platform
          ? `✅ ${starsNum}⭐ — посетитель ушёл оставлять отзыв на ${PLATFORM_NAMES[platform]}`
          : `⚠️ Оценка ${starsNum}⭐ — ${venue.name}\n\n"${String(message).trim().slice(0, 2000)}"\n\nКонтакт: ${
              (contact && String(contact).trim().slice(0, 200)) || 'не оставлен'
            }${roomNote}${tableNote}`

    let sent = 0
    await Promise.all(
      subs.map(async (s) => {
        const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: s.chat_id, text }),
        })
        if (tg.ok) {
          sent++
        } else if (tg.status === 403) {
          // пользователь заблокировал бота — тихо деактивируем подписку
          await supabase.from('venue_subscribers').update({ is_active: false }).eq('id', s.id)
        } else {
          console.error('telegram error:', tg.status, await tg.text())
        }
      }),
    )

    return json({ ok: true, sent })
  } catch (err) {
    console.error('notify error:', err)
    return json({ error: 'internal error' }, 500)
  }
})
