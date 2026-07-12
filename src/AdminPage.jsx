import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'

const EMPTY_VENUE = {
  slug: '',
  name: '',
  logo_url: '',
  welcome_text: 'Добро пожаловать!',
  yandex_review_url: '',
  google_review_url: '',
  gis2_review_url: '',
  menu_url: '',
  wifi_ssid: '',
  wifi_password: '',
  instagram_url: '',
  telegram_url: '',
  phone: '',
  address: '',
  owner_telegram_chat_id: '',
  accent_color: '#2563eb',
}

const FIELDS = [
  { key: 'slug', label: 'Slug (адрес страницы: /v/…)', required: true, hint: 'латиница, цифры, дефис' },
  { key: 'name', label: 'Название', required: true },
  { key: 'welcome_text', label: 'Приветствие' },
  { key: 'logo_url', label: 'Ссылка на логотип' },
  { key: 'yandex_review_url', label: 'Отзыв на Яндекс.Картах (URL)' },
  { key: 'google_review_url', label: 'Отзыв на Google Картах (URL)' },
  { key: 'gis2_review_url', label: 'Отзыв на 2ГИС (URL)' },
  { key: 'menu_url', label: 'Меню (URL на PDF/картинку)' },
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
  for (const k of Object.keys(EMPTY_VENUE)) form[k] = v?.[k] ?? form[k] ?? ''
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
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // null = список, 'new' = создание, объект = редактирование

  async function loadVenues() {
    setLoading(true)
    const { data } = await supabase.from('venues').select('*').order('created_at')
    setVenues(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadVenues()
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
        onBack={() => {
          setSelected(null)
          loadVenues()
        }}
      />
    )
  }

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
            <span className="venue-row-name">{v.name}</span>
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

function VenueEditor({ venue, onBack }) {
  const [form, setForm] = useState(venueToForm(venue))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [feedback, setFeedback] = useState([])

  const isNew = !venue

  useEffect(() => {
    if (isNew) return
    async function loadStats() {
      const [scans, ratings, fb] = await Promise.all([
        supabase.from('scans').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id),
        supabase.from('ratings').select('stars, redirected_to').eq('venue_id', venue.id),
        supabase
          .from('feedback')
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
    }
    loadStats()
  }, [venue, isNew])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const row = {}
    for (const [k, v] of Object.entries(form)) row[k] = typeof v === 'string' && v.trim() === '' ? null : v
    // slug/name/цвет обязательны, пустыми в базу не отправляем
    row.slug = (form.slug || '').trim().toLowerCase()
    row.name = (form.name || '').trim()
    row.accent_color = form.accent_color || '#2563eb'
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
          <label className="admin-field">
            <span>Цвет кнопок</span>
            <input
              type="color"
              value={form.accent_color || '#2563eb'}
              onChange={(e) => set('accent_color', e.target.value)}
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
