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
      const { data: roles } = await supabase
        .from('user_roles')
        .select('telegram_chat_id, phone')
      const match = (roles ?? []).find((r) => r.phone && phoneKey(r.phone) === key)
      // всегда отвечаем ok (не раскрываем, есть ли номер); код шлём только если нашли
      if (match) {
        const code = String(Math.floor(1000 + Math.random() * 9000))
        await supabase.from('cabinet_codes').insert({
          phone: key,
          chat_id: match.telegram_chat_id,
          code,
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        })
        await sendTelegram(
          match.telegram_chat_id,
          `Код входа в кабинет halo: ${code}\n\nНикому не сообщайте его. Код действует 5 минут.`,
        )
      }
      res.json({ ok: true })
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
    const path = `${kind === 'bg' ? 'bg' : 'logo'}-${req.params.id}-${Date.now()}.${ext}`
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

  return router
}
