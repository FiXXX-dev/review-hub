import React, { useEffect, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { HaloIcon } from './lib/logo.jsx'
import { BLOCK_DEFS } from './lib/blocks.js'

const TOKEN_KEY = 'halo-cabinet-token'

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`/api/cabinet${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export default function CabinetPage() {
  const [token, setToken] = useState(getToken)

  useEffect(() => {
    document.title = 'halo — кабинет'
  }, [])

  function onAuth(t) {
    try {
      localStorage.setItem(TOKEN_KEY, t)
    } catch {
      /* ignore */
    }
    setToken(t)
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setToken('')
  }

  if (!token) return <CabinetLogin onAuth={onAuth} />
  return <CabinetShell token={token} onLogout={logout} />
}

/* ─── Вход по номеру → код из Telegram ─── */
function CabinetLogin({ onAuth }) {
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(e) {
    e.preventDefault()
    if (busy || !phone.trim()) return
    setBusy(true)
    setError('')
    try {
      await api('/request-code', { method: 'POST', body: { phone } })
      setStep('code')
    } catch {
      setError('Не удалось отправить код. Попробуйте позже.')
    }
    setBusy(false)
  }

  async function verify(e) {
    e.preventDefault()
    if (busy || code.length !== 4) return
    setBusy(true)
    setError('')
    try {
      const { token } = await api('/verify-code', { method: 'POST', body: { phone, code } })
      onAuth(token)
    } catch (err) {
      setError(err.message || 'Неверный код')
    }
    setBusy(false)
  }

  return (
    <div className="page center">
      <form className="card admin-login" onSubmit={step === 'phone' ? requestCode : verify}>
        <HaloIcon className="halo-login-mark" size={40} />
        <h1 className="admin-title">Кабинет halo</h1>
        {step === 'phone' ? (
          <>
            <p className="admin-hint">
              Введите номер телефона — бот halo пришлёт код в Telegram. Доступ выдаёт halo; если
              вы ещё не подключены — напишите нам.
            </p>
            <input
              type="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {error && <p className="admin-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Отправляем…' : 'Получить код'}
            </button>
          </>
        ) : (
          <>
            <p className="admin-hint">Введите 4-значный код из Telegram.</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
            {error && <p className="admin-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 4}>
              {busy ? 'Проверяем…' : 'Войти'}
            </button>
            <button type="button" className="btn-link" onClick={() => setStep('phone')}>
              ← Изменить номер
            </button>
          </>
        )}
      </form>
    </div>
  )
}

/* ─── Оболочка кабинета: список заведений + разделы ─── */
function CabinetShell({ token, onLogout }) {
  const [state, setState] = useState({ loading: true })
  const [venueId, setVenueId] = useState(null)
  const [tab, setTab] = useState('profile')

  useEffect(() => {
    api('/me', { token })
      .then(({ venues }) => {
        setState({ loading: false, venues })
        if (venues.length) setVenueId(venues[0].id)
      })
      .catch((err) => {
        if (/unauthorized/i.test(err.message)) onLogout()
        else setState({ loading: false, venues: [], error: err.message })
      })
  }, [token])

  if (state.loading) {
    return (
      <div className="page center">
        <div className="spinner" />
      </div>
    )
  }

  if (!state.venues?.length) {
    return (
      <div className="page center">
        <div className="notfound">
          <div className="notfound-emoji">🔑</div>
          <h1>Доступ не настроен</h1>
          <p>Обратитесь к halo, чтобы вам выдали доступ к заведению.</p>
          <button className="btn-link" onClick={onLogout} style={{ marginTop: 12 }}>
            Выйти
          </button>
        </div>
      </div>
    )
  }

  const venue = state.venues.find((v) => v.id === venueId) || state.venues[0]
  const isOwner = venue.role === 'owner'

  return (
    <div className="page">
      <div className="container admin-container">
        <div className="admin-head">
          <span className="cab-logo">
            <HaloIcon size={20} className="halo-logo-icon" /> кабинет
          </span>
          <button className="btn-link" onClick={onLogout}>
            Выйти
          </button>
        </div>

        {state.venues.length > 1 && (
          <select
            className="cab-venue-select"
            value={venue.id}
            onChange={(e) => setVenueId(e.target.value)}
          >
            {state.venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}

        <div className="cab-tabs">
          {[
            ['profile', 'Профиль'],
            ['blocks', 'Блоки'],
            ['tables', 'Столы'],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`cab-tab ${tab === k ? 'on' : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && <ProfileSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
        {tab === 'blocks' && <BlocksSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
        {tab === 'tables' && <TablesSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
      </div>
    </div>
  )
}

function useVenue(token, venueId) {
  const [data, setData] = useState(null)
  const reload = useCallback(() => {
    api(`/venue/${venueId}`, { token }).then((r) => setData(r.venue))
  }, [token, venueId])
  useEffect(() => {
    reload()
  }, [reload])
  return [data, setData, reload]
}

/* ─── Профиль ─── */
const PROFILE_FIELDS = [
  { key: 'name', label: 'Название', required: true },
  { key: 'welcome_text', label: 'Приветствие' },
  { key: 'address', label: 'Адрес' },
  { key: 'phone', label: 'Телефон' },
]

function ProfileSection({ token, venue, isOwner }) {
  const [full, setFull] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/venue/${venue.id}`, { token }).then((r) => setFull(r.venue))
  }, [token, venue.id])

  function set(k, v) {
    setFull((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function uploadImage(kind, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const { url } = await api(`/venue/${venue.id}/upload`, {
          method: 'POST',
          token,
          body: { data_url: reader.result, kind },
        })
        set(kind === 'bg' ? 'background_image_url' : 'logo_url', url)
      } catch (err) {
        setError(err.message)
      }
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/venue/${venue.id}`, {
        method: 'PATCH',
        token,
        body: {
          name: full.name,
          welcome_text: full.welcome_text,
          address: full.address,
          phone: full.phone,
          logo_url: full.logo_url,
          background_image_url: full.background_image_url,
          accent_color: full.accent_color,
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (!full) return <div className="spinner" style={{ margin: '24px auto' }} />

  return (
    <div className="card admin-form">
      <ImageRow
        label="Логотип"
        value={full.logo_url}
        onFile={(f) => uploadImage('logo', f)}
        onClear={() => set('logo_url', '')}
        disabled={!isOwner}
      />
      <ImageRow
        label="Фон страницы"
        value={full.background_image_url}
        onFile={(f) => uploadImage('bg', f)}
        onClear={() => set('background_image_url', '')}
        disabled={!isOwner}
      />
      {PROFILE_FIELDS.map((f) => (
        <label key={f.key} className="admin-field">
          <span>{f.label}</span>
          <input
            type="text"
            value={full[f.key] ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
            disabled={!isOwner}
          />
        </label>
      ))}
      <label className="admin-field">
        <span>Цвет кнопок</span>
        <input
          type="color"
          value={full.accent_color || '#2563eb'}
          onChange={(e) => set('accent_color', e.target.value)}
          disabled={!isOwner}
        />
      </label>
      {error && <p className="admin-error">{error}</p>}
      {isOwner && (
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Сохраняем…' : saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      )}
    </div>
  )
}

function ImageRow({ label, value, onFile, onClear, disabled }) {
  return (
    <div className="admin-field">
      <span>{label}</span>
      <div className="logo-upload">
        {value ? (
          <img className="logo-preview" src={value} alt="" />
        ) : (
          <div className="logo-preview logo-preview-empty">—</div>
        )}
        {!disabled && (
          <>
            <label className="btn btn-secondary logo-upload-btn">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {value ? 'Заменить' : 'Загрузить'}
            </label>
            {value && (
              <button type="button" className="btn-link" onClick={onClear}>
                Убрать
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Блоки: показать/скрыть + порядок ─── */
function BlocksSection({ token, venue, isOwner }) {
  const [full, setFull] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api(`/venue/${venue.id}`, { token }).then((r) => setFull(r.venue))
  }, [token, venue.id])

  if (!full) return <div className="spinner" style={{ margin: '24px auto' }} />

  const presetTypes = (full.preset?.blocks ?? []).map((b) => b.type)
  const order = Array.isArray(full.enabled_blocks) && full.enabled_blocks.length
    ? full.enabled_blocks
    : presetTypes.length
      ? presetTypes
      : ['rating']
  const defFor = (t) => ({ ...BLOCK_DEFS[t], ...(full.preset?.blocks ?? []).find((b) => b.type === t) })

  // все известные типы: сначала в текущем порядке, потом остальные из пресета/реестра
  const known = [...order, ...presetTypes.filter((t) => !order.includes(t))]
  const rest = Object.keys(BLOCK_DEFS).filter((t) => !known.includes(t) && t !== 'service')
  const allTypes = [...known, ...rest]

  function setOrder(next) {
    setFull((f) => ({ ...f, enabled_blocks: next.includes('rating') ? next : ['rating', ...next] }))
    setSaved(false)
  }

  function toggle(t) {
    if (t === 'rating' || !isOwner) return
    if (order.includes(t)) setOrder(order.filter((x) => x !== t))
    else setOrder([...order, t])
  }

  function move(t, dir) {
    if (!isOwner) return
    const i = order.indexOf(t)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  async function save() {
    if (busy) return
    setBusy(true)
    await api(`/venue/${venue.id}`, {
      method: 'PATCH',
      token,
      body: { enabled_blocks: order },
    })
    setBusy(false)
    setSaved(true)
  }

  return (
    <div className="card admin-form">
      <p className="admin-hint">Включённые блоки — в порядке показа. Стрелками меняйте порядок.</p>
      <div className="cab-blocks">
        {order.map((t) => {
          const def = defFor(t)
          if (!def?.icon) return null
          return (
            <div key={t} className="cab-block-row on">
              <span className="cab-block-name">
                {def.icon} {def.label_ru}
              </span>
              {isOwner && (
                <span className="cab-block-actions">
                  <button className="btn-link" onClick={() => move(t, -1)} disabled={t === order[0]}>
                    ↑
                  </button>
                  <button
                    className="btn-link"
                    onClick={() => move(t, 1)}
                    disabled={t === order[order.length - 1]}
                  >
                    ↓
                  </button>
                  {t !== 'rating' && (
                    <button className="btn-link danger" onClick={() => toggle(t)}>
                      скрыть
                    </button>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {isOwner && allTypes.some((t) => !order.includes(t)) && (
        <>
          <p className="admin-hint" style={{ marginTop: 10 }}>Добавить блок:</p>
          <div className="block-toggles">
            {allTypes
              .filter((t) => !order.includes(t))
              .map((t) => {
                const def = defFor(t)
                if (!def?.icon) return null
                return (
                  <button key={t} className="block-toggle" onClick={() => toggle(t)}>
                    {def.icon} {def.label_ru}
                  </button>
                )
              })}
          </div>
        </>
      )}

      {isOwner && (
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? 'Сохраняем…' : saved ? '✓ Сохранено' : 'Сохранить порядок'}
        </button>
      )}
    </div>
  )
}

/* ─── Столы: список + QR + PDF ─── */
function TablesSection({ token, venue, isOwner }) {
  const [tables, setTables] = useState(null)
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const base = `${window.location.origin}${import.meta.env.BASE_URL}v/${venue.slug}`

  const load = useCallback(() => {
    api(`/venue/${venue.id}/tables`, { token }).then((r) => setTables(r.tables))
  }, [token, venue.id])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    const n = parseInt(number, 10)
    if (!Number.isInteger(n) || n < 1 || busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/venue/${venue.id}/tables`, { method: 'POST', token, body: { number: n } })
      setNumber('')
      load()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function remove(id) {
    setBusy(true)
    await api(`/venue/${venue.id}/tables/${id}`, { method: 'DELETE', token })
    setBusy(false)
    load()
  }

  async function downloadPdf() {
    const items = await Promise.all(
      (tables ?? []).map(async (t) => ({
        n: t.number,
        url: `${base}?table=${t.number}`,
        img: await QRCode.toDataURL(`${base}?table=${t.number}`, { width: 320, margin: 1 }),
      }))
    )
    const cards = items
      .map(
        (it) => `<div class="qr">
          <div class="qr-name">${venue.name} · Стол ${it.n}</div>
          <img src="${it.img}" />
          <div class="qr-url">${it.url}</div>
        </div>`
      )
      .join('')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR — ${venue.name}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Arial,sans-serif;margin:0;padding:16px;display:flex;flex-wrap:wrap;gap:16px}
        .qr{width:260px;border:1px solid #e6e8ec;border-radius:14px;padding:18px;text-align:center;page-break-inside:avoid}
        .qr-name{font-weight:700;font-size:15px;margin-bottom:10px}
        .qr img{width:220px;height:220px}
        .qr-url{font-size:10px;color:#888;word-break:break-all;margin-top:8px}
        @media print{.qr{border-color:#ccc}}
      </style></head><body>${cards}
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`)
    w.document.close()
  }

  if (!tables) return <div className="spinner" style={{ margin: '24px auto' }} />

  return (
    <div className="card admin-form">
      {isOwner && (
        <form className="tables-add" onSubmit={add}>
          <input
            type="number"
            min="1"
            placeholder="Номер стола"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <button className="btn-link" type="submit" disabled={busy || !number}>
            + Добавить
          </button>
        </form>
      )}
      {error && <p className="admin-error">{error}</p>}

      {tables.length === 0 ? (
        <p className="admin-empty">Столов пока нет.</p>
      ) : (
        <>
          <div className="tables-grid">
            {tables.map((t) => (
              <TableQR
                key={t.id}
                base={base}
                table={t}
                canRemove={isOwner}
                onRemove={() => remove(t.id)}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={downloadPdf} style={{ marginTop: 14 }}>
            Скачать все QR (PDF)
          </button>
        </>
      )}
    </div>
  )
}

function TableQR({ base, table, canRemove, onRemove }) {
  const [img, setImg] = useState('')
  useEffect(() => {
    QRCode.toDataURL(`${base}?table=${table.number}`, { width: 240, margin: 1 }).then(setImg)
  }, [base, table.number])
  return (
    <div className="table-qr">
      {img && <img src={img} alt={`Стол ${table.number}`} />}
      <div className="table-qr-name">Стол {table.number}</div>
      {canRemove && (
        <button className="btn-link danger" onClick={onRemove}>
          Удалить
        </button>
      )}
    </div>
  )
}
