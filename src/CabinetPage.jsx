import React, { useEffect, useState, useCallback, useRef } from 'react'
import QRCode from 'qrcode'
import { HaloIcon } from './lib/logo.jsx'
import { BLOCK_DEFS, formatPrice } from './lib/blocks.js'
import { pick, venueLangs, MENU_LANGS, LANG_NAMES } from './lib/menu.js'
import { api } from './lib/cabinetApi.js'
import WaiterScreen from './WaiterScreen.jsx'
import {
  buildPaymentUrl, PAYMENT_PROVIDERS, PAYMENT_HELP,
  validatePayme, validateClick, validateUrl, extractPaymeId,
} from './lib/paymentLinks.js'

const TOKEN_KEY = 'halo-cabinet-token'

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
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
      const r = await api('/request-code', { method: 'POST', body: { phone } })
      if (r.found === false) {
        setError('Этот номер не подключён к halo. Обратитесь к нам, чтобы выдать доступ.')
      } else if (r.sent === false) {
        setError('Код не доставлен в Telegram. Напишите боту halo /start со своего аккаунта и повторите.')
      } else {
        setStep('code')
      }
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

  const venueSelect = state.venues.length > 1 && (
    <select className="cab-venue-select" value={venue.id} onChange={(e) => setVenueId(e.target.value)}>
      {state.venues.map((v) => (
        <option key={v.id} value={v.id}>{v.name}</option>
      ))}
    </select>
  )

  // Официант видит только рабочий экран (POS), без настроек заведения.
  if (venue.role === 'waiter') {
    return (
      <div className="page">
        <div className="container waiter-container">
          <div className="admin-head">
            <span className="cab-logo">
              <HaloIcon size={20} className="halo-logo-icon" /> официант
            </span>
            <button className="btn-link" onClick={onLogout}>Выйти</button>
          </div>
          {venueSelect}
          <WaiterScreen key={venue.id} token={token} venue={venue} />
        </div>
      </div>
    )
  }

  // «Столы» и «Заказы» (ресторанный POS) — только для общепита; отелям,
  // барбершопам, клиникам и т.д. они не нужны.
  const isFoodVenue = venue.preset_key === 'restaurant'
  const tabs = [
    ['profile', 'Профиль'],
    ['blocks', 'Блоки'],
    ['menu', 'Меню'],
    ...(isFoodVenue ? [['tables', 'Столы']] : []),
    ...(isFoodVenue && isOwner ? [['orders', 'Заказы'], ['payment', 'Оплата']] : []),
  ]
  // если активная вкладка недоступна для этого заведения — падаем на «Профиль»
  const activeTab = tabs.some(([k]) => k === tab) ? tab : 'profile'

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

        {venueSelect}

        <div className="cab-tabs">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              className={`cab-tab ${activeTab === k ? 'on' : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && <ProfileSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
        {activeTab === 'blocks' && <BlocksSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
        {activeTab === 'menu' && <MenuSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
        {activeTab === 'tables' && <TablesSection key={venue.id} token={token} venue={venue} isOwner={isOwner} />}
        {activeTab === 'orders' && isOwner && <OrdersSection key={venue.id} token={token} venue={venue} />}
        {activeTab === 'payment' && isOwner && <PaymentSection key={venue.id} token={token} venue={venue} />}
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

  // картинки (лого/фон) сохраняем сразу — файл уже в Storage, отдельная
  // кнопка «Сохранить» тут только путала: превью менялось, а страница нет.
  async function persistField(k, v) {
    setFull((f) => ({ ...f, [k]: v }))
    try {
      await api(`/venue/${venue.id}`, { method: 'PATCH', token, body: { [k]: v } })
    } catch (err) {
      setError(err.message)
    }
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
        await persistField(kind === 'bg' ? 'background_image_url' : 'logo_url', url)
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
        onClear={() => persistField('logo_url', '')}
        disabled={!isOwner}
      />
      <ImageRow
        label="Фон страницы"
        value={full.background_image_url}
        onFile={(f) => uploadImage('bg', f)}
        onClear={() => persistField('background_image_url', '')}
        disabled={!isOwner}
      />
      {isOwner && (
        <p className="admin-hint" style={{ marginTop: -4 }}>
          Логотип и фон применяются сразу. Остальные поля — по кнопке «Сохранить».
        </p>
      )}
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

  // канонический адрес стола: /v/:slug/t/:N (старые ?table= редиректятся)
  const base = `${window.location.origin}${import.meta.env.BASE_URL}v/${venue.slug}/t/`

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
        url: `${base}${t.number}`,
        img: await QRCode.toDataURL(`${base}${t.number}`, { width: 320, margin: 1 }),
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
    QRCode.toDataURL(`${base}${table.number}`, { width: 240, margin: 1 }).then(setImg)
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

/* ─── Меню: секции → категории → позиции ─── */
const WEIGHT_UNITS = ['г', 'мл', 'шт']
const DELETE_CONFIRM = 'Удалить навсегда? Лучше скрыть, если планируете вернуть.'

// клиентское сжатие фото до 800px по длинной стороне перед загрузкой
function resizeImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width >= height && width > max) {
          height = Math.round((height * max) / width)
          width = max
        } else if (height > width && height > max) {
          width = Math.round((width * max) / height)
          height = max
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function MenuSection({ token, venue, isOwner }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null) // { kind, mode, parentId, row }
  const [openSec, setOpenSec] = useState({})
  const [openCat, setOpenCat] = useState({})

  const load = useCallback(() => {
    api(`/venue/${venue.id}/menu`, { token })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [token, venue.id])
  useEffect(() => {
    load()
  }, [load])

  const create = (kind, patch) => api(`/venue/${venue.id}/menu/${kind}`, { method: 'POST', token, body: patch })
  const patchRow = (kind, id, patch) => api(`/venue/${venue.id}/menu/${kind}/${id}`, { method: 'PATCH', token, body: patch })
  const delRow = (kind, id) => api(`/venue/${venue.id}/menu/${kind}/${id}`, { method: 'DELETE', token })
  const reorder = (kind, ids) => api(`/venue/${venue.id}/menu/${kind}/reorder`, { method: 'POST', token, body: { ids } })

  async function run(fn) {
    setError('')
    try {
      await fn()
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function move(kind, list, id, dir) {
    const i = list.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    const ids = list.map((x) => x.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await run(() => reorder(kind, ids))
  }

  async function uploadPhoto(dataUrl) {
    const { url } = await api(`/venue/${venue.id}/upload`, {
      method: 'POST',
      token,
      body: { data_url: dataUrl, kind: 'menu' },
    })
    return url
  }

  async function saveItem(patch) {
    if (form.mode === 'edit') await patchRow('item', form.row.id, patch)
    else await create('item', { ...patch, category_id: form.parentId })
    setForm(null)
    load()
  }

  if (error && !data) return <p className="admin-error" style={{ marginTop: 16 }}>{error}</p>
  if (!data) return <div className="spinner" style={{ margin: '24px auto' }} />

  const { sections, categories, items } = data
  const langs = venueLangs({ menu_languages: data.menu_languages })
  const guestUrl = `${import.meta.env.BASE_URL}v/${venue.slug}/menu`

  async function toggleLang(l) {
    if (l === 'ru') return // русский — базовый, всегда включён (фолбэк)
    const next = langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l]
    const ordered = MENU_LANGS.filter((x) => x === 'ru' || next.includes(x))
    await run(() => api(`/venue/${venue.id}`, { method: 'PATCH', token, body: { menu_languages: ordered } }))
  }

  return (
    <div className="card admin-form menu-mgr">
      <div className="menu-mgr-top">
        <a className="btn-link" href={guestUrl} target="_blank" rel="noreferrer">
          Посмотреть как гость ↗
        </a>
      </div>
      {isOwner && (
        <div className="menu-langs-pick">
          <span className="menu-langs-label">Языки меню на странице:</span>
          {MENU_LANGS.map((l) => (
            <label key={l} className="menu-lang-check">
              <input
                type="checkbox"
                checked={langs.includes(l)}
                disabled={l === 'ru'}
                onChange={() => toggleLang(l)}
              />
              {LANG_NAMES[l]}
              {l === 'ru' && <span className="menu-langs-base"> (базовый)</span>}
            </label>
          ))}
        </div>
      )}
      {error && <p className="admin-error">{error}</p>}

      {sections.length === 0 && (
        <p className="admin-empty">Пока нет ни одной секции. Добавьте первую.</p>
      )}

      {sections.map((s) => {
        const cats = categories.filter((c) => c.section_id === s.id)
        const open = openSec[s.id] !== false // по умолчанию раскрыто
        return (
          <div key={s.id} className={`menu-node menu-sec ${s.is_active ? '' : 'off'}`}>
            <div className="menu-node-head">
              <button className="menu-node-toggle" onClick={() => setOpenSec((o) => ({ ...o, [s.id]: !open }))}>
                {open ? '▾' : '▸'}
              </button>
              <span className="menu-node-title">
                {pick(s, 'title', 'ru')}
                {!s.is_active && <span className="menu-off-badge">скрыто</span>}
              </span>
              {isOwner && (
                <span className="menu-node-actions">
                  <button className="btn-link" onClick={() => move('section', sections, s.id, -1)}>↑</button>
                  <button className="btn-link" onClick={() => move('section', sections, s.id, 1)}>↓</button>
                  <button className="btn-link" onClick={() => setForm({ kind: 'section', mode: 'edit', row: s })}>изм.</button>
                  <button className="btn-link" onClick={() => run(() => patchRow('section', s.id, { is_active: !s.is_active }))}>
                    {s.is_active ? 'скрыть' : 'показать'}
                  </button>
                  <button
                    className="btn-link danger"
                    onClick={() => window.confirm(DELETE_CONFIRM) && run(() => delRow('section', s.id))}
                  >
                    удалить
                  </button>
                </span>
              )}
            </div>

            {open && (
              <div className="menu-node-body">
                {cats.map((c) => {
                  const its = items.filter((i) => i.category_id === c.id)
                  const copen = openCat[c.id] !== false
                  return (
                    <div key={c.id} className={`menu-node menu-cat ${c.is_active ? '' : 'off'}`}>
                      <div className="menu-node-head">
                        <button className="menu-node-toggle" onClick={() => setOpenCat((o) => ({ ...o, [c.id]: !copen }))}>
                          {copen ? '▾' : '▸'}
                        </button>
                        <span className="menu-node-title">
                          {pick(c, 'title', 'ru')} <span className="menu-count">({its.length})</span>
                          {!c.is_active && <span className="menu-off-badge">скрыто</span>}
                        </span>
                        {isOwner && (
                          <span className="menu-node-actions">
                            <button className="btn-link" onClick={() => move('category', cats, c.id, -1)}>↑</button>
                            <button className="btn-link" onClick={() => move('category', cats, c.id, 1)}>↓</button>
                            <button className="btn-link" onClick={() => setForm({ kind: 'category', mode: 'edit', row: c })}>изм.</button>
                            <button className="btn-link" onClick={() => run(() => patchRow('category', c.id, { is_active: !c.is_active }))}>
                              {c.is_active ? 'скрыть' : 'показать'}
                            </button>
                            {its.some((i) => i.is_active) && (
                              <button
                                className="btn-link"
                                onClick={() =>
                                  run(async () => {
                                    for (const i of its.filter((x) => x.is_active)) await patchRow('item', i.id, { is_active: false })
                                  })
                                }
                              >
                                скрыть все
                              </button>
                            )}
                            <button
                              className="btn-link danger"
                              onClick={() => window.confirm(DELETE_CONFIRM) && run(() => delRow('category', c.id))}
                            >
                              удалить
                            </button>
                          </span>
                        )}
                      </div>

                      {copen && (
                        <div className="menu-node-body">
                          {its.map((it) => (
                            <MenuItemRow
                              key={it.id}
                              item={it}
                              list={its}
                              isOwner={isOwner}
                              onPrice={(price) => run(() => patchRow('item', it.id, { price }))}
                              onEdit={() => setForm({ kind: 'item', mode: 'edit', parentId: c.id, row: it })}
                              onToggle={() => run(() => patchRow('item', it.id, { is_active: !it.is_active }))}
                              onMove={(dir) => move('item', its, it.id, dir)}
                              onDelete={() => window.confirm(DELETE_CONFIRM) && run(() => delRow('item', it.id))}
                            />
                          ))}
                          {isOwner && (
                            <button className="btn-link menu-add" onClick={() => setForm({ kind: 'item', mode: 'create', parentId: c.id })}>
                              + Позиция
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {isOwner && (
                  <button className="btn-link menu-add" onClick={() => setForm({ kind: 'category', mode: 'create', parentId: s.id })}>
                    + Категория
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {isOwner && (
        <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={() => setForm({ kind: 'section', mode: 'create' })}>
          + Секция
        </button>
      )}

      {form && (form.kind === 'section' || form.kind === 'category') && (
        <TitleForm
          title={form.kind === 'section' ? 'Секция' : 'Категория'}
          row={form.row}
          langs={langs}
          onCancel={() => setForm(null)}
          onSave={(patch) =>
            run(async () => {
              if (form.mode === 'edit') await patchRow(form.kind, form.row.id, patch)
              else await create(form.kind, form.kind === 'category' ? { ...patch, section_id: form.parentId } : patch)
              setForm(null)
            })
          }
        />
      )}

      {form && form.kind === 'item' && (
        <ItemForm
          row={form.row}
          langs={langs}
          onCancel={() => setForm(null)}
          onSave={saveItem}
          onUpload={uploadPhoto}
          setError={setError}
        />
      )}
    </div>
  )
}

function MenuItemRow({ item, isOwner, onPrice, onEdit, onToggle, onMove, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(item.price ?? '')

  function commit() {
    setEditing(false)
    const n = val === '' ? null : Number(val)
    if (n !== (item.price ?? null)) onPrice(n)
  }

  return (
    <div className={`menu-item-row ${item.is_active ? '' : 'off'}`}>
      <div className="menu-item-thumb">
        {item.photo_url ? <img src={item.photo_url} alt="" /> : <span>—</span>}
      </div>
      <div className="menu-item-main">
        <div className="menu-item-name">
          {pick(item, 'title', 'ru')}
          {item.is_new && <span className="menu-tag-new">NEW</span>}
          {!item.is_active && <span className="menu-off-badge">скрыто</span>}
        </div>
        <div className="menu-item-sub">
          {editing && isOwner ? (
            <input
              className="menu-price-input"
              type="number"
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setVal(item.price ?? '')
                  setEditing(false)
                }
              }}
            />
          ) : (
            <button className="menu-price-btn" disabled={!isOwner} onClick={() => setEditing(true)}>
              {item.price != null ? formatPrice(item.price, 'ru') : 'цена —'}
            </button>
          )}
          {item.weight_value ? <span className="menu-weight-badge">{item.weight_value} {item.weight_unit || ''}</span> : null}
        </div>
      </div>
      {isOwner && (
        <span className="menu-item-actions">
          <button className="btn-link" onClick={() => onMove(-1)}>↑</button>
          <button className="btn-link" onClick={() => onMove(1)}>↓</button>
          <button className="btn-link" onClick={onEdit}>изм.</button>
          <button className="btn-link" onClick={onToggle}>{item.is_active ? 'скрыть' : 'показать'}</button>
          <button className="btn-link danger" onClick={onDelete}>удалить</button>
        </span>
      )}
    </div>
  )
}

/* мини-форма для секции/категории: названия на языках заведения */
function TitleForm({ title, row, langs = ['ru', 'uz', 'en'], onCancel, onSave }) {
  const [v, setV] = useState({
    title_ru: row?.title_ru || '',
    title_uz: row?.title_uz || '',
    title_en: row?.title_en || '',
    title_tr: row?.title_tr || '',
  })
  return (
    <div className="menu-modal-back" onClick={onCancel}>
      <div className="menu-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{row ? `${title}: изменить` : `Новая ${title.toLowerCase()}`}</h3>
        {langs.map((l) => (
          <label key={l} className="admin-field">
            <span>Название ({l.toUpperCase()}){l === 'ru' ? ' *' : ''}</span>
            <input
              type="text"
              value={v[`title_${l}`]}
              onChange={(e) => setV((s) => ({ ...s, [`title_${l}`]: e.target.value }))}
            />
          </label>
        ))}
        <div className="menu-modal-foot">
          <button className="btn-link" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" disabled={!v.title_ru.trim()} onClick={() => onSave(v)}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

/* полная форма позиции */
function ItemForm({ row, langs = ['ru', 'uz', 'en'], onCancel, onSave, onUpload, setError }) {
  const [lang, setLang] = useState(langs[0] || 'ru')
  const [busy, setBusy] = useState(false)
  const [showKbju, setShowKbju] = useState(() => {
    const k = row?.kbju
    return !!(k && (k.calories || k.protein || k.fat || k.carbs))
  })
  const fileRef = useRef(null)
  const [f, setF] = useState(() => ({
    title_ru: row?.title_ru || '',
    title_uz: row?.title_uz || '',
    title_en: row?.title_en || '',
    title_tr: row?.title_tr || '',
    description_ru: row?.description_ru || '',
    description_uz: row?.description_uz || '',
    description_en: row?.description_en || '',
    description_tr: row?.description_tr || '',
    price: row?.price ?? '',
    weight_value: row?.weight_value ?? '',
    weight_unit: row?.weight_unit || 'г',
    photo_url: row?.photo_url || '',
    is_new: row?.is_new ?? false,
    is_active: row?.is_active ?? true,
    kbju: {
      calories: row?.kbju?.calories ?? '',
      protein: row?.kbju?.protein ?? '',
      fat: row?.kbju?.fat ?? '',
      carbs: row?.kbju?.carbs ?? '',
    },
  }))
  const set = (k, val) => setF((s) => ({ ...s, [k]: val }))
  const setK = (k, val) => setF((s) => ({ ...s, kbju: { ...s.kbju, [k]: val } }))

  async function pickFile(file) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await resizeImage(file)
      const url = await onUpload(dataUrl)
      set('photo_url', url)
    } catch (e) {
      setError?.(e.message || 'Не удалось загрузить фото')
    }
    setBusy(false)
  }

  function submit() {
    const kbjuVals = ['calories', 'protein', 'fat', 'carbs'].reduce((acc, k) => {
      const n = f.kbju[k] === '' ? null : Number(f.kbju[k])
      if (n != null && Number.isFinite(n)) acc[k] = n
      return acc
    }, {})
    onSave({
      title_ru: f.title_ru.trim(),
      title_uz: f.title_uz.trim() || null,
      title_en: f.title_en.trim() || null,
      title_tr: f.title_tr.trim() || null,
      description_ru: f.description_ru.trim() || null,
      description_uz: f.description_uz.trim() || null,
      description_en: f.description_en.trim() || null,
      description_tr: f.description_tr.trim() || null,
      price: f.price === '' ? null : Number(f.price),
      weight_value: f.weight_value === '' ? null : Number(f.weight_value),
      weight_unit: f.weight_unit,
      photo_url: f.photo_url || null,
      is_new: f.is_new,
      is_active: f.is_active,
      kbju: Object.keys(kbjuVals).length ? kbjuVals : null,
    })
  }

  return (
    <div className="menu-modal-back" onClick={onCancel}>
      <div className="menu-modal menu-modal-lg" onClick={(e) => e.stopPropagation()}>
        <h3>{row ? 'Изменить позицию' : 'Новая позиция'}</h3>

        <div
          className="menu-photo-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pickFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => fileRef.current?.click()}
        >
          {f.photo_url ? (
            <img src={f.photo_url} alt="" />
          ) : (
            <span>{busy ? 'Загрузка…' : 'Перетащите фото или нажмите'}</span>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
        {f.photo_url && (
          <div className="menu-photo-tools">
            <button className="btn-link" onClick={() => fileRef.current?.click()}>Заменить</button>
            <button className="btn-link danger" onClick={() => set('photo_url', '')}>Удалить фото</button>
          </div>
        )}

        <div className="menu-lang-tabs">
          {langs.map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="admin-field">
          <span>Название ({lang.toUpperCase()}){lang === 'ru' ? ' *' : ''}</span>
          <input type="text" value={f[`title_${lang}`]} onChange={(e) => set(`title_${lang}`, e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Описание ({lang.toUpperCase()})</span>
          <textarea rows={2} value={f[`description_${lang}`]} onChange={(e) => set(`description_${lang}`, e.target.value)} />
        </label>

        <div className="menu-form-row">
          <label className="admin-field">
            <span>Цена</span>
            <input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Вес / объём</span>
            <input type="number" value={f.weight_value} onChange={(e) => set('weight_value', e.target.value)} />
          </label>
          <label className="admin-field menu-unit-field">
            <span>Ед.</span>
            <select value={f.weight_unit} onChange={(e) => set('weight_unit', e.target.value)}>
              {WEIGHT_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>

        {showKbju ? (
          <div className="menu-form-row menu-kbju-row">
            {[['calories', 'Ккал'], ['protein', 'Белки'], ['fat', 'Жиры'], ['carbs', 'Углев.']].map(([k, l]) => (
              <label key={k} className="admin-field">
                <span>{l}</span>
                <input type="number" value={f.kbju[k]} onChange={(e) => setK(k, e.target.value)} />
              </label>
            ))}
          </div>
        ) : (
          <button className="btn-link" onClick={() => setShowKbju(true)}>+ Добавить КБЖУ</button>
        )}

        <div className="menu-toggles">
          <label className="menu-toggle">
            <input type="checkbox" checked={f.is_new} onChange={(e) => set('is_new', e.target.checked)} /> Новинка
          </label>
          <label className="menu-toggle">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Показывать
          </label>
        </div>

        <div className="menu-modal-foot">
          <button className="btn-link" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" disabled={busy || !f.title_ru.trim()} onClick={submit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Заказы: обзор для владельца (открытые столы + выручка за день) ─── */
function OrdersSection({ token, venue }) {
  const [open, setOpen] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    Promise.all([
      api(`/venue/${venue.id}/orders/open`, { token }),
      api(`/venue/${venue.id}/orders/history`, { token }),
    ])
      .then(([o, h]) => {
        setOpen(o.orders)
        setHistory(h)
      })
      .catch((e) => setError(e.message))
  }, [token, venue.id])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <p className="admin-error" style={{ marginTop: 16 }}>{error}</p>
  if (!open || !history) return <div className="spinner" style={{ margin: '24px auto' }} />

  const fmt = (n) => formatPrice(n, 'ru')
  const time = (s) => (s ? new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '')

  return (
    <div className="card admin-form">
      <div className="ord-stat">
        <div><span className="ord-stat-num">{fmt(history.revenue)}</span><span className="ord-stat-lbl">выручка сегодня</span></div>
        <div><span className="ord-stat-num">{history.count}</span><span className="ord-stat-lbl">закрыто заказов</span></div>
        <div><span className="ord-stat-num">{open.length}</span><span className="ord-stat-lbl">открытых столов</span></div>
      </div>

      <div className="ord-head">
        <h3 className="admin-subtitle">Открытые столы</h3>
        <button className="btn-link" onClick={load}>Обновить</button>
      </div>
      {open.length === 0 ? (
        <p className="admin-empty">Открытых столов нет.</p>
      ) : (
        open.map((o) => (
          <div key={o.id} className="ord-row">
            <span className="ord-row-main">
              Стол {o.table_number}
              <span className="ord-row-sub">{o.waiter_phone || '—'} · с {time(o.created_at)}</span>
            </span>
            <span className="ord-row-sum">{fmt(o.total)}</span>
          </div>
        ))
      )}

      <h3 className="admin-subtitle" style={{ marginTop: 18 }}>Закрытые сегодня</h3>
      {history.orders.length === 0 ? (
        <p className="admin-empty">Пока нет закрытых заказов.</p>
      ) : (
        history.orders.map((o) => (
          <div key={o.id} className="ord-row done">
            <span className="ord-row-main">
              Стол {o.table_number}
              <span className="ord-row-sub">{o.waiter_phone || '—'} · {time(o.closed_at)}</span>
            </span>
            <span className="ord-row-sum">{fmt(o.total)}</span>
          </div>
        ))
      )}
    </div>
  )
}

/* ─── Оплата: пошаговый мастер подключения платёжного шлюза ─── */
function PaymentSection({ token, venue }) {
  const [full, setFull] = useState(null)
  const [step, setStep] = useState(1)
  const [provider, setProvider] = useState(null)
  const [merchantId, setMerchantId] = useState('') // payme
  const [clickService, setClickService] = useState('') // click
  const [clickMerchant, setClickMerchant] = useState('')
  const [url, setUrl] = useState('') // uzum/custom
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [testOk, setTestOk] = useState(null) // null | true | false
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/venue/${venue.id}`, { token }).then((r) => {
      const v = r.venue
      setFull(v)
      if (v.payment_provider) {
        setProvider(v.payment_provider)
        if (v.payment_provider === 'click') {
          const [s, m] = String(v.payment_merchant_id || '').split(':')
          setClickService(s || '')
          setClickMerchant(m || '')
        } else if (v.payment_provider === 'payme') {
          setMerchantId(v.payment_merchant_id || '')
        } else {
          setUrl(v.payment_custom_url || '')
        }
        setStep(v.payment_enabled ? 3 : 2)
      }
    })
  }, [token, venue.id])

  if (!full) return <div className="spinner" style={{ margin: '24px auto' }} />

  const account = () =>
    provider === 'payme' ? extractPaymeId(merchantId)
      : provider === 'click' ? `${clickService.trim()}:${clickMerchant.trim()}`
        : url.trim()
  const validate = () =>
    provider === 'payme' ? validatePayme(merchantId)
      : provider === 'click' ? validateClick(clickService, clickMerchant)
        : validateUrl(url)

  async function persist(patch) {
    await api(`/venue/${venue.id}`, { method: 'PATCH', token, body: patch })
    setFull((f) => ({ ...f, ...patch }))
  }

  function pickProvider(p) {
    setProvider(p)
    setError('')
    setTestOk(null)
    setShowHelp(false)
    setStep(2)
  }

  async function toTest() {
    const err = validate()
    if (err) return setError(err)
    if (provider === 'payme') setMerchantId(extractPaymeId(merchantId)) // подчистим поле
    setError('')
    setBusy(true)
    const patch = { payment_provider: provider }
    if (provider === 'payme' || provider === 'click') {
      patch.payment_merchant_id = account()
      patch.payment_custom_url = null
    } else {
      patch.payment_custom_url = account()
      patch.payment_merchant_id = null
    }
    try {
      await persist(patch)
      setTestOk(null)
      setStep(3)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  function openTest() {
    const link = buildPaymentUrl(provider, account(), { amount: 1000, orderId: 'test-halo' })
    if (!link) return setError('Не удалось собрать ссылку — проверьте реквизиты.')
    window.open(link, '_blank', 'noopener')
  }

  async function confirmWorks(ok) {
    setTestOk(ok)
    if (ok) await persist({ payment_enabled: true })
  }

  async function disable() {
    setBusy(true)
    await persist({ payment_enabled: false })
    setBusy(false)
    setStep(1)
  }

  const connected = full.payment_enabled

  return (
    <div className="card admin-form pay-wizard">
      <div className={`pay-status ${connected ? 'on' : ''}`}>
        <span className="pay-status-dot" />
        {connected ? 'Оплата подключена' : 'Оплата не подключена'}
        {connected && (
          <button className="btn-link" style={{ marginLeft: 'auto' }} onClick={() => setStep(1)}>
            изменить
          </button>
        )}
      </div>

      <p className="admin-hint">
        Гость платит напрямую вашему банку — halo деньги не хранит и не обрабатывает. Подтверждение
        оплаты официант ставит вручную.
      </p>

      {step === 1 && (
        <>
          <div className="pay-step-label">Шаг 1. Выберите платёжную систему</div>
          <div className="pay-providers">
            {PAYMENT_PROVIDERS.map((p) => (
              <button
                key={p.key}
                className={`pay-provider ${provider === p.key ? 'on' : ''}`}
                style={{ '--pv': p.color }}
                onClick={() => pickProvider(p.key)}
              >
                <span className="pay-provider-mark">{p.name[0]}</span>
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="pay-step-label">Шаг 2. Реквизиты</div>
          {provider === 'payme' && (
            <label className="admin-field">
              <span>Merchant ID (ID кассы Payme)</span>
              <input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} placeholder="587f72c72cac0d162c722ae2" />
            </label>
          )}
          {provider === 'click' && (
            <div className="pay-form-row">
              <label className="admin-field">
                <span>Service ID</span>
                <input value={clickService} onChange={(e) => setClickService(e.target.value)} placeholder="12345" />
              </label>
              <label className="admin-field">
                <span>Merchant ID</span>
                <input value={clickMerchant} onChange={(e) => setClickMerchant(e.target.value)} placeholder="6789" />
              </label>
            </div>
          )}
          {(provider === 'uzum' || provider === 'custom') && (
            <label className="admin-field">
              <span>Платёжная ссылка</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…  (можно с {amount} и {order_id})" />
            </label>
          )}

          <button className="btn-link" onClick={() => setShowHelp((s) => !s)}>
            {showHelp ? 'Скрыть' : 'Где взять?'}
          </button>
          {showHelp && (
            <ol className="pay-help">
              {(PAYMENT_HELP[provider] || []).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}

          {error && <p className="admin-error">{error}</p>}
          <div className="pay-actions">
            <button className="btn-link" onClick={() => setStep(1)}>← Назад</button>
            <button className="btn btn-primary" onClick={toTest} disabled={busy}>Далее</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="pay-step-label">Шаг 3. Проверка</div>
          <p className="admin-hint">Откроем вашу платёжную страницу на 1 000 сум. Оплачивать не нужно — просто проверьте, что страница банка открывается и сумма верная.</p>
          <button className="btn btn-secondary" onClick={openTest}>Проверить оплату на 1 000 сум</button>

          <div className="pay-confirm">
            <span>Всё открылось корректно?</span>
            <div className="pay-confirm-btns">
              <button className={`btn-link ${testOk === true ? 'on' : ''}`} onClick={() => confirmWorks(true)}>Да</button>
              <button className={`btn-link ${testOk === false ? 'on' : ''}`} onClick={() => confirmWorks(false)}>Нет</button>
            </div>
          </div>

          {testOk === true && <p className="pay-ok">✓ Оплата подключена. Гости увидят кнопку «Оплатить онлайн» в своём счёте.</p>}
          {testOk === false && (
            <div className="pay-tips">
              <p>Что чаще всего неверно:</p>
              <ul>
                {provider === 'payme' && <li>ID кассы скопирован не полностью (нужно 24 символа) или взят из тестовой кассы.</li>}
                {provider === 'click' && <li>Перепутаны местами Service ID и Merchant ID, либо сервис в Click ещё не активирован.</li>}
                {(provider === 'uzum' || provider === 'custom') && <li>Ссылка скопирована не целиком или без https://. Проверьте {'{amount}'} и {'{order_id}'}.</li>}
                <li>Реквизиты от другого заведения/кассы.</li>
              </ul>
              <button className="btn-link" onClick={() => setStep(2)}>← Исправить реквизиты</button>
            </div>
          )}

          <div className="pay-actions" style={{ marginTop: 14 }}>
            <button className="btn-link" onClick={() => setStep(2)}>← Реквизиты</button>
            {connected && <button className="btn-link danger" onClick={disable} disabled={busy}>Отключить оплату</button>}
          </div>
        </>
      )}
    </div>
  )
}
