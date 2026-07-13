// Перезапускаемый сид демо-заведения Bon!
// Запуск: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_CHAT_ID=... node scripts/seed-bon.mjs
// Повторный запуск не затирает ссылки, заполненные вручную в Supabase.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_CHAT_ID } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Нужны env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (и опционально DEMO_CHAT_ID)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const brand = {
  name: 'Bon!',
  welcome_text: 'Спасибо, что зашли к нам',
  accent_color: '#6B2737',
  preset_key: 'restaurant',
  enabled_blocks: ['rating', 'menu', 'wifi', 'instagram'],
}

// DEMO_CHAT_ID подписывается на уведомления как владелец (venue_subscribers)
async function subscribeOwner(venueId) {
  if (!DEMO_CHAT_ID) return
  const { error } = await supabase
    .from('venue_subscribers')
    .upsert(
      { venue_id: venueId, chat_id: String(DEMO_CHAT_ID), role: 'owner', is_active: true },
      { onConflict: 'venue_id,chat_id' }
    )
  if (error) throw error
  console.log(`Подписчик ${DEMO_CHAT_ID} подключён как owner`)
}

const { data: existing, error: selErr } = await supabase
  .from('venues')
  .select('id')
  .eq('slug', 'bon')
  .maybeSingle()
if (selErr) throw selErr

if (existing) {
  const { error } = await supabase.from('venues').update(brand).eq('id', existing.id)
  if (error) throw error
  await subscribeOwner(existing.id)
  console.log('Bon! обновлён (ссылки не тронуты)')
} else {
  const { data: created, error } = await supabase
    .from('venues')
    .insert({
      slug: 'bon',
      yandex_review_url: '',
      google_review_url: '',
      gis2_review_url: '',
      menu_url: '',
      instagram_url: '',
      wifi_ssid: '',
      wifi_password: '',
      ...brand,
    })
    .select('id')
    .single()
  if (error) throw error
  await subscribeOwner(created.id)
  console.log('Bon! создан')
}
