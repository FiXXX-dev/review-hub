import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { BLOCK_DEFS, LINK_TYPES, SERVICE_OPTIONS } from './lib/blocks.js'

const EMPTY_VENUE = {
  slug: '',
  name: '',
  logo_url: '',
  welcome_text: 'Добро пожаловать!',
  yandex_review_url: '',
  google_review_url: '',
  gis2_review_url: '',
  wifi_ssid: '',
  wifi_password: '',
  instagram_url: '',
  telegram_url: '',
  phone: '',
  address: '',
  owner_telegram_chat_id: '',
  accent_color: '#2563eb',
  text_color: '',
  background_image_url: '',
  preset_key: '',
  enabled_blocks: null,
  block_links: {},
  service_options: null,
  rating_platform_order: null,
}

const FIELDS = [
  { key: 'slug', label: 'Slug (адрес страницы: /v/…)', required: true, hint: 'латиница, цифры, дефис' },
  { key: 'name', label: 'Название', required: true },
  { key: 'welcome_text', label: 'Приветствие' },
  { key: 'yandex_review_url', label: 'Отзыв на Яндекс.Картах (URL)' },
  { key: 'google_review_url', label: 'Отзыв на Google Картах (URL)' },
  { key: 'gis2_review_url', label: 'Отзыв на 2ГИС (URL)' },
  { key: 'wifi_ssid', label: 'Wi-Fi сеть' },
  { key: 'wifi_password', label: 'Wi-Fi пароль' },
  { key: 'instagram_url', label: 'Instagram (URL)' },
  { key: 'telegram_url', label: 'Telegram (URL)' },
  { key: 'phone', label: 'Телефон' },
  { key: 'address', label: 'Адрес' },
  { key: 'owner_telegram_chat_id', label: 'Telegram chat_id владельца (для уведомлений)' },
]

function venueToForm(v) {
  const form = { ...EMPTY_VENUE }
  for (const k of Object.keys(EMPTY_VENUE)) {
    const val = v?.[k]
    if (val !== undefined && val !== null) form[k] = val
  }
  // массивы/объекты — строго нужного типа или null (не пустая строка!)
  form.enabled_blocks = Array.isArray(v?.enabled_blocks) ? v.enabled_blocks : null
  form.service_options = Array.isArray(v?.service_options) ? v.service_options : null
  form.rating_platform_order = Array.isArray(v?.rating_platform_order)
    ? v.rating_platform_order
    : null
  form.block_links =
    v?.block_links && typeof v.block_links === 'object' ? { ...v.block_links } : {}
  // menu_url — поле до block_links; показываем его как ссылку блока menu
  if (v?.menu_url && !form.block_links.menu) form.block_links.menu = v.menu_url
  return form
}

export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) return <div className="page center">Supabase не настроен</div>
  if (!authReady) {
    return (
      <div className="page center">
        <div className="spinner" />
      </div>
    )
  }
  return session ? <Dashboard /> : <Login />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Неверный email или пароль')
    setBusy(false)
  }

  return (
    <div className="page center">
      <form className="card admin-login" onSubmit={submit}>
        <img className="halo-login-mark" src={`${import.meta.env.BASE_URL}halo.svg`} alt="halo" />
        <h1 className="admin-title">halo — админка</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="admin-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}

function Dashboard() {
  const [venues, setVenues] = useState([])
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // null = список, 'new' = создание, объект = редактирование

  async function loadAll() {
    setLoading(true)
    const [v, p] = await Promise.all([
      supabase.from('venues').select('*').order('created_at'),
      supabase.from('presets').select('*').order('name'),
    ])
    setVenues(v.data ?? [])
    setPresets(p.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  if (loading) {
    return (
      <div className="page center">
        <div className="spinner" />
      </div>
    )
  }

  if (selected) {
    return (
      <VenueEditor
        venue={selected === 'new' ? null : selected}
        presets={presets}
        onBack={() => {
          setSelected(null)
          loadAll()
        }}
      />
    )
  }

  const presetName = (key) => presets.find((p) => p.key === key)?.name

  return (
    <div className="page">
      <div className="container admin-container">
        <div className="admin-head">
          <h1 className="admin-title">Заведения</h1>
          <button className="btn-link" onClick={() => supabase.auth.signOut()}>
            Выйти
          </button>
        </div>
        {venues.map((v) => (
          <button key={v.id} className="card venue-row" onClick={() => setSelected(v)}>
            <span className="venue-row-name">
              {v.name}
              {v.preset_key && <span className="venue-row-preset">{presetName(v.preset_key)}</span>}
            </span>
            <span className="venue-row-slug">/v/{v.slug}</span>
          </button>
        ))}
        {venues.length === 0 && <p className="admin-empty">Пока нет ни одного заведения.</p>}
        <button className="btn btn-primary" onClick={() => setSelected('new')}>
          + Добавить заведение
        </button>
      </div>
    </div>
  )
}

function VenueEditor({ venue, presets, onBack }) {
  const [form, setForm] = useState(venueToForm(venue))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [appointments, setAppointments] = useState([])
  const [serviceRequests, setServiceRequests] = useState([])

  const isNew = !venue
  const preset = presets.find((p) => p.key === form.preset_key)

  useEffect(() => {
    if (isNew) return
    async function loadStats() {
      const [scans, ratings, fb, appts, srv] = await Promise.all([
        supabase.from('scans').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id),
        supabase.from('ratings').select('stars, redirected_to').eq('venue_id', venue.id),
        supabase
          .from('feedback')
          .select('*')
          .eq('venue_id', venue.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('appointments')
          .select('*')
          .eq('venue_id', venue.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('service_requests')
          .select('*')
          .eq('venue_id', venue.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])
      const byStars = [0, 0, 0, 0, 0]
      let redirected = 0
      for (const r of ratings.data ?? []) {
        byStars[r.stars - 1]++
        if (r.redirected_to) redirected++
      }
      setStats({ scans: scans.count ?? 0, total: (ratings.data ?? []).length, byStars, redirected })
      setFeedback(fb.data ?? [])
      setAppointments(appts.data ?? [])
      setServiceRequests(srv.data ?? [])
    }
    loadStats()
  }, [venue, isNew])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // ─── блоки ───
  // порядок отображения: блоки пресета, затем остальные известные типы
  const presetTypes = (preset?.blocks ?? []).map((b) => b.type)
  const allTypes = [...presetTypes, ...Object.keys(BLOCK_DEFS).filter((t) => !presetTypes.includes(t))]
  const enabled = Array.isArray(form.enabled_blocks)
    ? form.enabled_blocks
    : presetTypes.length
      ? presetTypes
      : []

  function blockDef(type) {
    return { ...BLOCK_DEFS[type], ...(preset?.blocks ?? []).find((b) => b.type === type) }
  }

  function toggleBlock(type) {
    if (type === 'rating') return // ядро продукта — не отключается
    const next = enabled.includes(type)
      ? enabled.filter((t) => t !== type)
      : allTypes.filter((t) => enabled.includes(t) || t === type)
    set('enabled_blocks', next.includes('rating') ? next : ['rating', ...next])
  }

  function pickPreset(key) {
    const p = presets.find((x) => x.key === key)
    setForm((f) => ({
      ...f,
      preset_key: key,
      // состав блоков подставляем из пресета, дальше можно редактировать
      enabled_blocks: p ? p.blocks.map((b) => b.type) : f.enabled_blocks,
      // у отелей Google первым — гости в основном туристы
      rating_platform_order: key === 'hotel' ? ['google', 'yandex', '2gis'] : f.rating_platform_order,
      accent_color:
        p?.default_theme && (isNew || f.accent_color === EMPTY_VENUE.accent_color)
          ? p.default_theme
          : f.accent_color,
    }))
  }

  function toggleServiceOption(key) {
    const all = SERVICE_OPTIONS.map((o) => o.key)
    const current = form.service_options ?? all
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    // все включены = null (дефолт)
    set('service_options', next.length === all.length ? null : next)
  }

  function setLink(type, url) {
    setForm((f) => ({ ...f, block_links: { ...f.block_links, [type]: url } }))
  }

  const enabledLinkTypes = enabled.filter((t) => LINK_TYPES.includes(t))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const row = {}
    for (const [k, v] of Object.entries(form)) row[k] = typeof v === 'string' && v.trim() === '' ? null : v
    row.slug = (form.slug || '').trim().toLowerCase()
    row.name = (form.name || '').trim()
    row.accent_color = form.accent_color || '#2563eb'
    row.preset_key = form.preset_key || null
    row.enabled_blocks = form.enabled_blocks?.length ? form.enabled_blocks : null
    row.block_links = Object.fromEntries(
      Object.entries(form.block_links || {})
        .map(([t, u]) => [t, (u || '').trim()])
        .filter(([, u]) => u)
    )
    if (!/^[a-z0-9-]+$/.test(row.slug)) {
      setError('Slug: только латиница в нижнем регистре, цифры и дефис')
      setBusy(false)
      return
    }
    const query = isNew
      ? supabase.from('venues').insert(row)
      : supabase.from('venues').update(row).eq('id', venue.id)
    const { error } = await query
    if (error) {
      setError(error.code === '23505' ? 'Такой slug уже занят' : `Не сохранилось: ${error.message}`)
      setBusy(false)
      return
    }
    onBack()
  }

  async function remove() {
    if (!confirm(`Удалить «${venue.name}» вместе со всей статистикой?`)) return
    setBusy(true)
    await supabase.from('venues').delete().eq('id', venue.id)
    onBack()
  }

  const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL}v/${form.slug}`

  return (
    <div className="page">
      <div className="container admin-container">
        <div className="admin-head">
          <button className="btn-link" onClick={onBack}>
            ← Назад
          </button>
          {!isNew && (
            <a className="btn-link" href={publicUrl} target="_blank" rel="noreferrer">
              Открыть страницу ↗
            </a>
          )}
        </div>
        <h1 className="admin-title">{isNew ? 'Новое заведение' : form.name}</h1>

        <form className="card admin-form" onSubmit={save}>
          <label className="admin-field">
            <span>Тип заведения (пресет)</span>
            <select value={form.preset_key || ''} onChange={(e) => pickPreset(e.target.value)}>
              <option value="">— без пресета —</option>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-field">
            <span>Блоки на странице</span>
            <div className="block-toggles">
              {allTypes.map((t) => {
                const def = blockDef(t)
                if (!def?.icon) return null
                const on = enabled.includes(t)
                return (
                  <label key={t} className={`block-toggle ${on ? 'on' : ''} ${t === 'rating' ? 'locked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={t === 'rating'}
                      onChange={() => toggleBlock(t)}
                    />
                    {def.icon} {def.label_ru}
                  </label>
                )
              })}
            </div>
          </div>

          {enabled.includes('service') && (
            <div className="admin-field">
              <span>Запросы в блоке «Обслуживание номера»</span>
              <div className="block-toggles">
                {SERVICE_OPTIONS.map((o) => {
                  const on = !form.service_options || form.service_options.includes(o.key)
                  return (
                    <label key={o.key} className={`block-toggle ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleServiceOption(o.key)} />
                      {o.label_ru}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {enabledLinkTypes.length > 0 && (
            <div className="admin-field">
              <span>Ссылки блоков</span>
              {enabledLinkTypes.map((t) => {
                const def = blockDef(t)
                return (
                  <input
                    key={t}
                    type="text"
                    placeholder={`${def.icon} ${def.label_ru} — URL`}
                    value={form.block_links[t] || ''}
                    onChange={(e) => setLink(t, e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                )
              })}
            </div>
          )}

          {FIELDS.map((f) => (
            <label key={f.key} className="admin-field">
              <span>
                {f.label}
                {f.required && ' *'}
              </span>
              <input
                type="text"
                value={form[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                required={f.required}
                placeholder={f.hint || ''}
              />
            </label>
          ))}

          <ImageField
            label="Логотип"
            value={form.logo_url}
            onChange={(url) => set('logo_url', url)}
            filePrefix={form.slug || 'venue'}
          />

          <ImageField
            label="Фон страницы"
            value={form.background_image_url}
            onChange={(url) => set('background_image_url', url)}
            filePrefix={`bg-${form.slug || 'venue'}`}
            hint="Ужимай до ~900px по ширине, лучше webp — быстрее грузится"
          />

          <label className="admin-field">
            <span>Цвет кнопок</span>
            <input
              type="color"
              value={form.accent_color || '#2563eb'}
              onChange={(e) => set('accent_color', e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Цвет текста (пусто = стандартный тёмный)</span>
            <input
              type="text"
              placeholder="#3E2A20"
              value={form.text_color ?? ''}
              onChange={(e) => set('text_color', e.target.value)}
            />
          </label>
          {error && <p className="admin-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {!isNew && (
            <button className="btn btn-danger" type="button" onClick={remove} disabled={busy}>
              Удалить заведение
            </button>
          )}
        </form>

        {!isNew && stats && (
          <div className="card admin-stats">
            <h2 className="admin-subtitle">Статистика</h2>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-num">{stats.scans}</div>
                <div className="stat-label">сканов</div>
              </div>
              <div className="stat">
                <div className="stat-num">{stats.total}</div>
                <div className="stat-label">оценок</div>
              </div>
              <div className="stat">
                <div className="stat-num">{stats.redirected}</div>
                <div className="stat-label">ушли на карты</div>
              </div>
            </div>
            <div className="star-bars">
              {[5, 4, 3, 2, 1].map((s) => (
                <div key={s} className="star-bar-row">
                  <span className="star-bar-label">{s}★</span>
                  <div className="star-bar">
                    <div
                      className="star-bar-fill"
                      style={{
                        width: stats.total ? `${(stats.byStars[s - 1] / stats.total) * 100}%` : 0,
                      }}
                    />
                  </div>
                  <span className="star-bar-count">{stats.byStars[s - 1]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isNew && serviceRequests.length > 0 && (
          <div className="card admin-stats">
            <h2 className="admin-subtitle">Заявки в номер</h2>
            {serviceRequests.map((s) => (
              <div key={s.id} className="feedback-item">
                <div className="feedback-meta">
                  {new Date(s.created_at).toLocaleString('ru-RU')} · номер {s.room}
                </div>
                <div className="feedback-text">
                  {SERVICE_OPTIONS.find((o) => o.key === s.request_type)?.label_ru || s.request_type}
                  {s.comment ? ` — ${s.comment}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isNew && appointments.length > 0 && (
          <div className="card admin-stats">
            <h2 className="admin-subtitle">Записи</h2>
            {appointments.map((a) => (
              <div key={a.id} className="feedback-item">
                <div className="feedback-meta">
                  {new Date(a.created_at).toLocaleString('ru-RU')}
                  {a.preferred_time ? ` · хочет: ${a.preferred_time}` : ''}
                </div>
                <div className="feedback-text">
                  {a.name} · {a.phone}
                  {a.service ? ` · ${a.service}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isNew && feedback.length > 0 && (
          <div className="card admin-stats">
            <h2 className="admin-subtitle">Приватные отзывы</h2>
            {feedback.map((f) => (
              <div key={f.id} className="feedback-item">
                <div className="feedback-meta">
                  {'★'.repeat(f.stars)} · {new Date(f.created_at).toLocaleString('ru-RU')}
                  {f.contact ? ` · ${f.contact}` : ''}
                </div>
                <div className="feedback-text">{f.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Картинка (лого/фон): загрузка в Supabase Storage (бакет logos) ─── */
function ImageField({ label, value, onChange, filePrefix, hint }) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // чтобы можно было выбрать тот же файл повторно
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('Нужна картинка: PNG, JPG, SVG или WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Файл больше 5 МБ — сожми картинку')
      return
    }
    setErr('')
    setUploading(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const prefix = (filePrefix || 'venue').trim() || 'venue'
    const path = `${prefix}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
    if (error) {
      setErr(
        /bucket/i.test(error.message)
          ? 'Бакет logos не найден — выполни миграцию 0005 в Supabase'
          : `Не загрузилось: ${error.message}`
      )
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  return (
    <div className="admin-field">
      <span>{label}</span>
      <div className="logo-upload">
        {value ? (
          <img className="logo-preview" src={value} alt="" />
        ) : (
          <div className="logo-preview logo-preview-empty">—</div>
        )}
        <label className={`btn btn-secondary logo-upload-btn ${uploading ? 'disabled' : ''}`}>
          <input type="file" accept="image/*" onChange={onFile} disabled={uploading} hidden />
          {uploading ? 'Загружаем…' : value ? 'Заменить' : 'Загрузить'}
        </label>
        {value && (
          <button type="button" className="btn-link" onClick={() => onChange('')}>
            Убрать
          </button>
        )}
      </div>
      <input
        type="text"
        placeholder="…или вставь прямую ссылку на картинку"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="admin-hint">{hint}</p>}
      {err && <p className="admin-error">{err}</p>}
    </div>
  )
}
