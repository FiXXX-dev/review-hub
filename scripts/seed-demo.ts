// Демо-заведение halo-demo для стенда takeaway. Идемпотентно: повторный
// запуск обновляет существующие строки и не плодит дубли (поиск по slug /
// названиям).
//
// Запуск:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-demo.ts
//   (или: node --experimental-strip-types scripts/seed-demo.ts)
//
// Требует применённой миграции 0017_takeaway.sql.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key)

const VENUE = {
  slug: 'halo-demo',
  name: 'halo demo coffee',
  mode: 'takeaway',
  queue_load: 0,
  accent_color: '#2563eb',
  welcome_text: 'Демо-кофейня для проверки заказа навынос',
  // тестовый мерчант: провайдер custom с заглушкой-шаблоном; в мок-режиме
  // (VITE_PAYMENTS_MOCK=true) клиент на неё не ходит
  payment_enabled: true,
  payment_provider: 'custom',
  payment_custom_url: 'https://example.com/pay?sum={amount}&ref={order_id}',
}

type SeedItem = {
  cat: string
  title: string
  price: number
  prep: number
  desc?: string
}

// 8 позиций с разным временем приготовления
const ITEMS: SeedItem[] = [
  { cat: 'Кофе', title: 'Эспрессо', price: 18000, prep: 3 },
  { cat: 'Кофе', title: 'Капучино', price: 28000, prep: 4, desc: 'Молоко на выбор' },
  { cat: 'Кофе', title: 'Латте', price: 30000, prep: 4 },
  { cat: 'Чай', title: 'Чай чёрный', price: 15000, prep: 3 },
  { cat: 'Еда', title: 'Круассан', price: 22000, prep: 2, desc: 'Сливочный, свежий' },
  { cat: 'Еда', title: 'Сэндвич с курицей', price: 38000, prep: 8, desc: 'Греется на месте' },
  { cat: 'Десерты', title: 'Чизкейк', price: 32000, prep: 2 },
  { cat: 'Десерты', title: 'Тирамису', price: 35000, prep: 2 },
]

async function upsertVenue(): Promise<string> {
  const { data: existing, error: selErr } = await db
    .from('venues')
    .select('id')
    .eq('slug', VENUE.slug)
    .maybeSingle()
  if (selErr) throw selErr
  if (existing) {
    const { error } = await db.from('venues').update(VENUE).eq('id', existing.id)
    if (error) throw error
    console.log('venue updated:', existing.id)
    return existing.id
  }
  const { data, error } = await db.from('venues').insert(VENUE).select('id').single()
  if (error) throw error
  console.log('venue created:', data.id)
  return data.id
}

async function findOrCreate(
  table: string,
  match: Record<string, unknown>,
  insert: Record<string, unknown>,
): Promise<string> {
  let q = db.from(table).select('id')
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never)
  const { data: found, error: selErr } = await q.maybeSingle()
  if (selErr) throw selErr
  if (found) {
    // обновляем изменяемые поля, id сохраняется
    const { error } = await db.from(table).update(insert).eq('id', found.id)
    if (error) throw error
    return found.id
  }
  const { data, error } = await db.from(table).insert({ ...match, ...insert }).select('id').single()
  if (error) throw error
  return data.id
}

async function main() {
  const venueId = await upsertVenue()

  const sectionId = await findOrCreate(
    'menu_sections',
    { venue_id: venueId, title_ru: 'Меню' },
    { sort_order: 0, is_active: true },
  )

  const catIds = new Map<string, string>()
  const catNames = [...new Set(ITEMS.map((i) => i.cat))]
  for (let i = 0; i < catNames.length; i++) {
    const id = await findOrCreate(
      'menu_categories',
      { venue_id: venueId, title_ru: catNames[i] },
      { section_id: sectionId, sort_order: i, is_active: true },
    )
    catIds.set(catNames[i], id)
  }

  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i]
    await findOrCreate(
      'menu_items',
      { venue_id: venueId, title_ru: it.title },
      {
        category_id: catIds.get(it.cat),
        description_ru: it.desc ?? null,
        price: it.price,
        prep_minutes: it.prep,
        is_available: true,
        is_active: true,
        sort_order: i,
      },
    )
  }

  console.log(`ok: halo-demo с ${ITEMS.length} позициями (${catNames.length} категории)`)
  console.log('гость:   /v/halo-demo')
  console.log('бариста: /staff/halo-demo/queue (появится в шаге 4)')
}

main().catch((e) => {
  console.error('seed failed:', e.message ?? e)
  process.exit(1)
})
