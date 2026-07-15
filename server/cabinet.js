// Кабинет владельца: вход по Telegram-коду + доступ к данным через бэкенд.
// Владелец никогда не получает ключей Supabase — все запросы идут сюда,
// а доступ проверяется по user_roles сервисным ключом.
import crypto from 'node:crypto'
import express from 'express'

const SESSION_SECRET = process.env.CABINET_SESSION_SECRET || ''
const SESSION_TTL = 30 * 24 * 3600 // 30 дней
const CODE_TTL_MS = 5 * 60 * 1000 // 5 минут

// поля профиля/блоков, которые владелец может менять (slug и preset — только суперадмин)
const EDITABLE = new Set([
  'name', 'welcome_text', 'logo_url', 'accent_color', 'text_color', 'background_image_url',
  'address', 'phone', 'enabled_blocks', 'block_links',
  'wifi_ssid', 'wifi_password', 'instagram_url', 'telegram_url', 'menu_url',
  'yandex_review_url', 'google_review_url', 'gis2_review_url',
  'service_options', 'rating_platform_order', 'taxi_classes',
])

const b64u = (buf) => Buffer.from(buf).toString('base64url')

export function signToken(payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }))
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token) {
  if (!token || !SESSION_SECRET) return null
  const [body, sig] = String(token).split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  // constant-time сравнение
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

// последние 9 цифр номера — устойчиво к +998 / 998 / пробелам
export function phoneKey(p) {
  const digits = String(p || '').replace(/\D/g, '')
  return digits.slice(-9)
}

export function createCabinetRouter({ supabase, sendTelegram }) {
  const router = express.Router()

  // ── вход: запрос кода ──
  router.post('/request-code', async (req, res) => {
    try {
      const key = phoneKey(req.body?.phone)
      if (key.length < 7) return res.status(400).json({ error: 'bad phone' })
      if (!supabase) return res.status(503).json({ error: 'not configured' })

      // ищем владельца с таким телефоном в user_roles
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('telegram_chat_id, phone')
      if (rolesErr) {
        console.error('request-code: user_roles error (миграция 0012?):', rolesErr.message)
        return res.status(500).json({ error: 'db' })
      }
      const match = (roles ?? []).find((r) => r.phone && phoneKey(r.phone) === key)
      // это B2B-вход (доступ выдаёт halo), поэтому честно сообщаем, если номера нет
      if (!match) {
        console.log('request-code: номер не найден в user_roles:', key)
        return res.json({ ok: true, found: false })
      }
      const code = String(Math.floor(1000 + Math.random() * 9000))
      const { error: insErr } = await supabase.from('cabinet_codes').insert({
        phone: key,
        chat_id: match.telegram_chat_id,
        code,
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      })
      if (insErr) {
        console.error('request-code: cabinet_codes insert error:', insErr.message)
        return res.status(500).json({ error: 'db' })
      }
      const sent = await sendTelegram(
        match.telegram_chat_id,
        `Код входа в кабинет halo: ${code}\n\nНикому не сообщайте его. Код действует 5 минут.`,
      )
      res.json({ ok: true, found: true, sent })
    } catch (err) {
      console.error('request-code error:', err)
      res.status(500).json({ error: 'internal' })
    }
  })

  // ── вход: проверка кода ──
  router.post('/verify-code', async (req, res) => {
    try {
      const key = phoneKey(req.body?.phone)
      const code = String(req.body?.code || '').trim()
      if (key.length < 7 || !/^\d{4}$/.test(code)) return res.status(400).json({ error: 'bad input' })
      if (!supabase) return res.status(503).json({ error: 'not configured' })

      const { data: rows } = await supabase
        .from('cabinet_codes')
        .select('*')
        .eq('phone', key)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
      const row = rows?.[0]
      if (!row) return res.status(401).json({ error: 'неверный или просроченный код' })

      await supabase.from('cabinet_codes').update({ used: true }).eq('id', row.id)
      res.json({ token: signToken({ chat_id: row.chat_id }) })
    } catch (err) {
      console.error('verify-code error:', err)
      res.status(500).json({ error: 'internal' })
    }
  })

  // ── middleware: сессия + доступ к заведению ──
  async function auth(req, res, next) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const data = verifyToken(token)
    if (!data) return res.status(401).json({ error: 'unauthorized' })
    req.chatId = data.chat_id
    next()
  }

  async function loadRole(chatId, venueId) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('telegram_chat_id', chatId)
      .eq('venue_id', venueId)
      .maybeSingle()
    return data?.role || null
  }

  // ── список заведений владельца ──
  router.get('/me', auth, async (req, res) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('venue_id, role')
      .eq('telegram_chat_id', req.chatId)
    if (!roles?.length) return res.json({ venues: [] })
    const ids = roles.map((r) => r.venue_id)
    const { data: venues } = await supabase
      .from('venues')
      .select('id, name, slug, accent_color, logo_url')
      .in('id', ids)
    const roleById = Object.fromEntries(roles.map((r) => [r.venue_id, r.role]))
    res.json({ venues: (venues ?? []).map((v) => ({ ...v, role: roleById[v.id] })) })
  })

  // ── одно заведение (полные данные) ──
  router.get('/venue/:id', auth, async (req, res) => {
    const role = await loadRole(req.chatId, req.params.id)
    if (!role) return res.status(403).json({ error: 'forbidden' })
    const { data } = await supabase
      .from('venues')
      .select('*, preset:presets(*)')
      .eq('id', req.params.id)
      .maybeSingle()
    if (!data) return res.status(404).json({ error: 'not found' })
    res.json({ venue: data, role })
  })

  // ── обновление профиля/блоков (только владелец) ──
  router.patch('/venue/:id', auth, async (req, res) => {
    const role = await loadRole(req.chatId, req.params.id)
    if (role !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const patch = {}
    for (const [k, v] of Object.entries(req.body || {})) {
      if (EDITABLE.has(k)) patch[k] = v
    }
    if (!Object.keys(patch).length) return res.json({ ok: true })
    const { error } = await supabase.from('venues').update(patch).eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── загрузка картинки (лого/фон) ──
  router.post('/venue/:id/upload', auth, async (req, res) => {
    const role = await loadRole(req.chatId, req.params.id)
    if (role !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const { data_url, kind } = req.body || {}
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(data_url || '')
    if (!m) return res.status(400).json({ error: 'bad image' })
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'too large' })
    const ext = (m[1].split('/')[1] || 'png').replace('+xml', '')
    const prefix = kind === 'bg' ? 'bg' : kind === 'menu' ? 'menu' : 'logo'
    const path = `${prefix}-${req.params.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('logos')
      .upload(path, buf, { contentType: m[1], upsert: true })
    if (error) return res.status(400).json({ error: error.message })
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    res.json({ url: data.publicUrl })
  })

  // ── столы ──
  router.get('/venue/:id/tables', auth, async (req, res) => {
    if (!(await loadRole(req.chatId, req.params.id))) return res.status(403).json({ error: 'forbidden' })
    const { data } = await supabase
      .from('venue_tables')
      .select('*')
      .eq('venue_id', req.params.id)
      .order('number')
    res.json({ tables: data ?? [] })
  })

  router.post('/venue/:id/tables', auth, async (req, res) => {
    if ((await loadRole(req.chatId, req.params.id)) !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const number = parseInt(req.body?.number, 10)
    if (!Number.isInteger(number) || number < 1) return res.status(400).json({ error: 'bad number' })
    const { error } = await supabase.from('venue_tables').insert({
      venue_id: req.params.id,
      number,
      label: (req.body?.label || '').trim() || null,
    })
    if (error) return res.status(400).json({ error: error.code === '23505' ? 'Такой стол уже есть' : error.message })
    res.json({ ok: true })
  })

  router.delete('/venue/:id/tables/:tableId', auth, async (req, res) => {
    if ((await loadRole(req.chatId, req.params.id)) !== 'owner') return res.status(403).json({ error: 'forbidden' })
    await supabase.from('venue_tables').delete().eq('id', req.params.tableId).eq('venue_id', req.params.id)
    res.json({ ok: true })
  })

  // ── меню: секции → категории → позиции ──
  const MENU_TABLES = {
    section: 'menu_sections',
    category: 'menu_categories',
    item: 'menu_items',
  }
  // белые списки полей на запись (venue_id проставляется из URL)
  const MENU_FIELDS = {
    section: ['title_ru', 'title_uz', 'title_en', 'sort_order', 'is_active'],
    category: ['section_id', 'title_ru', 'title_uz', 'title_en', 'sort_order', 'is_active'],
    item: [
      'category_id', 'title_ru', 'title_uz', 'title_en',
      'description_ru', 'description_uz', 'description_en',
      'price', 'weight_value', 'weight_unit', 'kbju', 'photo_url',
      'is_new', 'is_active', 'sort_order',
    ],
  }

  function menuPatch(kind, body) {
    const allow = MENU_FIELDS[kind]
    const patch = {}
    for (const [k, v] of Object.entries(body || {})) {
      if (allow.includes(k)) patch[k] = v === '' ? null : v
    }
    return patch
  }

  // всё меню целиком (включая скрытое) — для кабинета
  router.get('/venue/:id/menu', auth, async (req, res) => {
    if (!(await loadRole(req.chatId, req.params.id))) return res.status(403).json({ error: 'forbidden' })
    const vid = req.params.id
    const [sec, cat, items] = await Promise.all([
      supabase.from('menu_sections').select('*').eq('venue_id', vid).order('sort_order'),
      supabase.from('menu_categories').select('*').eq('venue_id', vid).order('sort_order'),
      supabase.from('menu_items').select('*').eq('venue_id', vid).order('sort_order'),
    ])
    res.json({
      sections: sec.data ?? [],
      categories: cat.data ?? [],
      items: items.data ?? [],
    })
  })

  // создать секцию/категорию/позицию
  router.post('/venue/:id/menu/:kind', auth, async (req, res) => {
    if ((await loadRole(req.chatId, req.params.id)) !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const table = MENU_TABLES[req.params.kind]
    if (!table) return res.status(400).json({ error: 'bad kind' })
    const patch = menuPatch(req.params.kind, req.body)
    if (!patch.title_ru) return res.status(400).json({ error: 'Заполните название (RU)' })
    // sort_order по умолчанию — в конец списка
    if (patch.sort_order == null) {
      const { data: last } = await supabase
        .from(table)
        .select('sort_order')
        .eq('venue_id', req.params.id)
        .order('sort_order', { ascending: false })
        .limit(1)
      patch.sort_order = (last?.[0]?.sort_order ?? -1) + 1
    }
    const { data, error } = await supabase
      .from(table)
      .insert({ ...patch, venue_id: req.params.id })
      .select()
      .maybeSingle()
    if (error) return res.status(400).json({ error: error.message })
    res.json({ row: data })
  })

  // обновить
  router.patch('/venue/:id/menu/:kind/:rowId', auth, async (req, res) => {
    if ((await loadRole(req.chatId, req.params.id)) !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const table = MENU_TABLES[req.params.kind]
    if (!table) return res.status(400).json({ error: 'bad kind' })
    const patch = menuPatch(req.params.kind, req.body)
    if (!Object.keys(patch).length) return res.json({ ok: true })
    const { error } = await supabase
      .from(table)
      .update(patch)
      .eq('id', req.params.rowId)
      .eq('venue_id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  })

  // порядок: body { ids: [...] } → sort_order = индекс
  router.post('/venue/:id/menu/:kind/reorder', auth, async (req, res) => {
    if ((await loadRole(req.chatId, req.params.id)) !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const table = MENU_TABLES[req.params.kind]
    if (!table) return res.status(400).json({ error: 'bad kind' })
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    for (let i = 0; i < ids.length; i++) {
      await supabase.from(table).update({ sort_order: i }).eq('id', ids[i]).eq('venue_id', req.params.id)
    }
    res.json({ ok: true })
  })

  // удалить навсегда (в кабинете по умолчанию — скрытие через is_active)
  router.delete('/venue/:id/menu/:kind/:rowId', auth, async (req, res) => {
    if ((await loadRole(req.chatId, req.params.id)) !== 'owner') return res.status(403).json({ error: 'forbidden' })
    const table = MENU_TABLES[req.params.kind]
    if (!table) return res.status(400).json({ error: 'bad kind' })
    await supabase.from(table).delete().eq('id', req.params.rowId).eq('venue_id', req.params.id)
    res.json({ ok: true })
  })

  return router
}
