import React, { useEffect, useState } from 'react'
import { Sparkles, Bed, GlassWater, Clock, Wrench, Car, Coffee, Shirt, BellRing } from 'lucide-react'
import { supabase } from './lib/supabase.js'
import { formatPrice } from './lib/blocks.js'

const ICON_OPTIONS = [
  { key: 'bell', label: 'Колокольчик', Icon: BellRing },
  { key: 'cleaning', label: 'Уборка', Icon: Sparkles },
  { key: 'towels', label: 'Кровать / бельё', Icon: Bed },
  { key: 'water', label: 'Вода', Icon: GlassWater },
  { key: 'breakfast', label: 'Завтрак / кофе', Icon: Coffee },
  { key: 'laundry', label: 'Прачечная', Icon: Shirt },
  { key: 'late_checkout', label: 'Часы', Icon: Clock },
  { key: 'broken', label: 'Ремонт', Icon: Wrench },
  { key: 'taxi', label: 'Такси', Icon: Car },
]

// Управление услугами заведения: /admin/services/:slug
// ПОКА без авторизации (по требованию) — доступ по прямой ссылке.

function rowToDraft(s) {
  return {
    icon: s.icon ?? '',
    title_ru: s.title_ru ?? '',
    price: s.price == null ? '' : String(s.price),
    is_free: !!s.is_free,
    require_comment: !!s.require_comment,
    is_active: !!s.is_active,
  }
}

export default function ServicesAdminPage({ slug }) {
  const [venue, setVenue] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({}) // id -> draft
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const { data: v } = await supabase
      .from('venues')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle()
    setVenue(v ?? null)
    if (v) {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('venue_id', v.id)
        .order('sort_order')
      setItems(data ?? [])
      setDrafts(Object.fromEntries((data ?? []).map((s) => [s.id, rowToDraft(s)])))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [slug])

  function setDraft(id, key, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }))
  }

  function draftToRow(draft) {
    const price = draft.price === '' ? null : Number(draft.price)
    return {
      icon: draft.icon.trim() || null,
      title_ru: draft.title_ru.trim(),
      price: Number.isFinite(price) ? price : null,
      is_free: draft.is_free,
      require_comment: draft.require_comment,
      is_active: draft.is_active,
    }
  }

  async function saveRow(id) {
    const draft = drafts[id]
    if (!draft?.title_ru.trim() || busy) return
    setBusy(true)
    await supabase.from('services').update(draftToRow(draft)).eq('id', id)
    setBusy(false)
    load()
  }

  async function removeRow(id) {
    if (!confirm('Удалить услугу?') || busy) return
    setBusy(true)
    await supabase.from('services').delete().eq('id', id)
    setBusy(false)
    load()
  }

  async function move(idx, dir) {
    const other = idx + dir
    if (other < 0 || other >= items.length || busy) return
    setBusy(true)
    const a = items[idx]
    const b = items[other]
    // порядок задаётся sort_order — просто меняем значения местами
    await Promise.all([
      supabase.from('services').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('services').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    setBusy(false)
    load()
  }

  async function addRow(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const maxOrder = items.reduce((m, s) => Math.max(m, s.sort_order), 0)
    await supabase.from('services').insert({
      venue_id: venue.id,
      title_ru: 'Новая услуга',
      is_free: true,
      sort_order: maxOrder + 1,
    })
    setBusy(false)
    load()
  }

  if (loading) {
    return (
      <div className="page center">
        <div className="spinner" />
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="page center">
        <div className="notfound">
          <div className="notfound-emoji">🔍</div>
          <h1>Заведение не найдено</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container admin-container">
        <h1 className="admin-title">Услуги — {venue.name}</h1>
        <p className="admin-hint">
          Название, цена (пусто + галка «бесплатно» = бейдж «Бесплатно»), порядок стрелками.
          Изменения видны на странице сразу после «Сохранить».
        </p>
        <div className="card">
          {items.map((s, idx) => {
            const d = drafts[s.id]
            if (!d) return null
            return (
              <div key={s.id} className={`svc-admin-row ${d.is_active ? '' : 'inactive'}`}>
                <div className="svc-admin-line">
                  <span className="svc-admin-icon-preview">
                    {(() => {
                      const opt = ICON_OPTIONS.find((o) => o.key === d.icon)
                      if (opt) return <opt.Icon size={20} strokeWidth={1.8} />
                      return d.icon ? <span>{d.icon}</span> : <BellRing size={20} strokeWidth={1.8} />
                    })()}
                  </span>
                  <select
                    className="svc-admin-icon-select"
                    value={ICON_OPTIONS.some((o) => o.key === d.icon) ? d.icon : ''}
                    onChange={(e) => setDraft(s.id, 'icon', e.target.value)}
                  >
                    <option value="">{d.icon && !ICON_OPTIONS.some((o) => o.key === d.icon) ? `эмодзи: ${d.icon}` : 'без иконки'}</option>
                    {ICON_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="svc-admin-title"
                    type="text"
                    placeholder="Название услуги"
                    value={d.title_ru}
                    onChange={(e) => setDraft(s.id, 'title_ru', e.target.value)}
                  />
                </div>
                <div className="svc-admin-line">
                  <input
                    className="svc-admin-price"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Цена"
                    value={d.price}
                    onChange={(e) => setDraft(s.id, 'price', e.target.value)}
                  />
                  <span className="admin-hint">
                    {d.is_free || d.price === '' ? 'Бесплатно' : formatPrice(d.price)}
                  </span>
                </div>
                <div className="svc-admin-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={d.is_free}
                      onChange={(e) => setDraft(s.id, 'is_free', e.target.checked)}
                    />
                    бесплатно
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={d.require_comment}
                      onChange={(e) => setDraft(s.id, 'require_comment', e.target.checked)}
                    />
                    комментарий обязателен
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={d.is_active}
                      onChange={(e) => setDraft(s.id, 'is_active', e.target.checked)}
                    />
                    показывать
                  </label>
                </div>
                <div className="svc-admin-actions">
                  <button type="button" className="btn-link" disabled={busy} onClick={() => move(idx, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn-link" disabled={busy} onClick={() => move(idx, 1)}>
                    ↓
                  </button>
                  <button type="button" className="btn-link" disabled={busy} onClick={() => saveRow(s.id)}>
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="btn-link danger"
                    disabled={busy}
                    onClick={() => removeRow(s.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )
          })}
          {items.length === 0 && <p className="admin-empty">Услуг пока нет.</p>}
        </div>
        <button className="btn btn-primary" onClick={addRow} disabled={busy}>
          + Добавить услугу
        </button>
      </div>
    </div>
  )
}
