import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UtensilsCrossed, ArrowLeft, X } from 'lucide-react'
import { supabase } from './lib/supabase.js'
import { formatPrice } from './lib/blocks.js'
import { pick, MENU_UI, venueLangs } from './lib/menu.js'
import { getInitialLang } from './lib/i18n.jsx'
import { useTable } from './lib/table.jsx'

export default function MenuPage({ slug }) {
  const { venueUrl } = useTable() // назад — с сохранением стола
  const [lang, setLang] = useState(() => {
    const init = getInitialLang()
    return ['ru', 'uz', 'en'].includes(init) ? init : 'ru'
  })
  const [data, setData] = useState(null) // { venue, sections, categories, items }
  const [loading, setLoading] = useState(true)
  const [sectionId, setSectionId] = useState(null)
  const [catId, setCatId] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null) // блюдо в модалке

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) return setLoading(false)
      const { data: venue } = await supabase
        .from('venues')
        .select(
          'id, slug, name, logo_url, accent_color, text_color, background_image_url, menu_url, menu_languages'
        )
        .eq('slug', slug)
        .maybeSingle()
      if (!venue) {
        if (!cancelled) setLoading(false)
        return
      }
      const [sec, cat, items] = await Promise.all([
        supabase.from('menu_sections').select('*').eq('venue_id', venue.id).eq('is_active', true).order('sort_order'),
        supabase.from('menu_categories').select('*').eq('venue_id', venue.id).eq('is_active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('venue_id', venue.id).eq('is_active', true).order('sort_order'),
      ])
      if (cancelled) return
      const sections = sec.data ?? []
      const categories = cat.data ?? []
      const list = items.data ?? []
      // пусто и есть внешняя ссылка → это fallback-меню, уводим на неё
      if (!list.length && venue.menu_url) {
        window.location.replace(venue.menu_url)
        return
      }
      setData({ venue, sections, categories, items: list })
      setSectionId(sections[0]?.id ?? null)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const langs = data ? venueLangs(data.venue) : ['ru', 'uz', 'en']

  // если текущий язык не входит в набор заведения — переключаемся на первый доступный
  useEffect(() => {
    if (data && !langs.includes(lang)) setLang(langs[0])
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (data?.venue?.accent_color)
      document.documentElement.style.setProperty('--accent', data.venue.accent_color)
    if (data?.venue?.text_color)
      document.documentElement.style.setProperty('--text', data.venue.text_color)
    if (data?.venue?.name) document.title = `${MENU_UI[lang].menu} · ${data.venue.name}`
  }, [data, lang])

  const t = MENU_UI[lang] || MENU_UI.ru

  const view = useMemo(() => {
    if (!data) return null
    const { sections, categories, items } = data
    const sec = sectionId || sections[0]?.id
    // категории текущей секции (если секций нет — все категории)
    const cats = sections.length
      ? categories.filter((c) => c.section_id === sec)
      : categories
    const catIds = new Set(cats.map((c) => c.id))
    // позиции: в категориях текущей секции (или все, если категорий нет)
    let list = cats.length ? items.filter((i) => catIds.has(i.category_id)) : items
    if (catId === 'new') list = list.filter((i) => i.is_new)
    else if (catId !== 'all') list = list.filter((i) => i.category_id === catId)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((i) => pick(i, 'title', lang).toLowerCase().includes(q))
    const hasNew = (cats.length ? items.filter((i) => catIds.has(i.category_id)) : items).some(
      (i) => i.is_new
    )
    return { cats, list, hasNew }
  }, [data, sectionId, catId, query, lang])

  if (loading) {
    return (
      <div className="page center">
        <div className="spinner" />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="page center">
        <div className="notfound">
          <div className="notfound-emoji">🍽️</div>
          <h1>Меню не найдено</h1>
        </div>
      </div>
    )
  }

  const { venue, sections } = data
  const bg = venue.background_image_url

  return (
    <div className="menu-page">
      <header className="menu-head">
        <a className="menu-back" href={venueUrl} aria-label="Назад">
          <ArrowLeft size={20} />
        </a>
        <div className="menu-head-title">
          {venue.logo_url && <img className="menu-logo" src={venue.logo_url} alt="" />}
          <span>{venue.name}</span>
        </div>
        {langs.length > 1 && (
          <div className="menu-lang">
            {langs.map((l) => (
              <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="menu-body">
        {sections.length > 1 && (
          <div className="menu-sections">
            {sections.map((s) => (
              <button
                key={s.id}
                className={`menu-section ${sectionId === s.id ? 'on' : ''}`}
                onClick={() => {
                  setSectionId(s.id)
                  setCatId('all')
                }}
              >
                {pick(s, 'title', lang)}
              </button>
            ))}
          </div>
        )}

        <div className="menu-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="menu-chips">
          <button className={`menu-chip ${catId === 'all' ? 'on' : ''}`} onClick={() => setCatId('all')}>
            {t.all}
          </button>
          {view.hasNew && (
            <button className={`menu-chip ${catId === 'new' ? 'on' : ''}`} onClick={() => setCatId('new')}>
              {t.new}
            </button>
          )}
          {view.cats.map((c) => (
            <button
              key={c.id}
              className={`menu-chip ${catId === c.id ? 'on' : ''}`}
              onClick={() => setCatId(c.id)}
            >
              {pick(c, 'title', lang)}
            </button>
          ))}
        </div>

        {view.list.length === 0 ? (
          <p className="menu-empty">{t.empty}</p>
        ) : (
          <div className="menu-grid">
            {view.list.map((item) => (
              <MenuCard key={item.id} item={item} lang={lang} onOpen={() => setSelected(item)} />
            ))}
          </div>
        )}
      </div>
      <div className="menu-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} aria-hidden="true" />
      {selected && <DishModal item={selected} lang={lang} onClose={() => setSelected(null)} />}
    </div>
  )
}

function MenuCard({ item, lang, onOpen }) {
  const desc = pick(item, 'description', lang)
  const k = item.kbju
  const hasKbju = k && (k.calories || k.protein || k.fat || k.carbs)
  return (
    <div
      className="menu-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="menu-photo">
        {item.photo_url ? (
          <img src={item.photo_url} alt="" loading="lazy" />
        ) : (
          <div className="menu-photo-empty">
            <UtensilsCrossed size={26} strokeWidth={1.6} />
          </div>
        )}
        {item.is_new && <span className="menu-new">NEW</span>}
      </div>
      <div className="menu-card-body">
        <div className="menu-item-title">{pick(item, 'title', lang)}</div>
        {desc && <div className="menu-item-desc">{desc}</div>}
        <div className="menu-item-foot">
          {item.price != null && <span className="menu-price">{formatPrice(item.price, lang)}</span>}
          {item.weight_value && (
            <span className="menu-weight">
              {item.weight_value} {item.weight_unit || ''}
            </span>
          )}
        </div>
        {hasKbju && (
          <div className="menu-kbju">
            {k.calories ? <span>{k.calories} ккал</span> : null}
            {k.protein ? <span>Б {k.protein}</span> : null}
            {k.fat ? <span>Ж {k.fat}</span> : null}
            {k.carbs ? <span>У {k.carbs}</span> : null}
          </div>
        )}
      </div>
    </div>
  )
}

function DishModal({ item, lang, onClose }) {
  const t = MENU_UI[lang] || MENU_UI.ru
  const desc = pick(item, 'description', lang)
  const k = item.kbju
  const hasKbju = k && (k.calories || k.protein || k.fat || k.carbs)
  const [drag, setDrag] = useState(0)
  const startY = useRef(null)

  // блокируем скролл фона + закрытие по Escape, пока модалка открыта
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // свайп вниз для закрытия (мобильный bottom-sheet)
  function onTouchStart(e) {
    startY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (startY.current == null) return
    const dy = e.touches[0].clientY - startY.current
    setDrag(dy > 0 ? dy : 0)
  }
  function onTouchEnd() {
    if (drag > 90) onClose()
    else setDrag(0)
    startY.current = null
  }

  return (
    <div className="dish-overlay" onClick={onClose}>
      <div
        className="dish-sheet"
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="dish-photo"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {item.photo_url ? (
            <img src={item.photo_url} alt="" />
          ) : (
            <div className="dish-photo-empty">
              <UtensilsCrossed size={46} strokeWidth={1.4} />
            </div>
          )}
          {item.is_new && <span className="menu-new dish-new">NEW</span>}
          <button className="dish-close" onClick={onClose} aria-label={t.close}>
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        <div className="dish-body">
          <h2 className="dish-title">{pick(item, 'title', lang)}</h2>
          <div className="dish-badges">
            {item.price != null && <span className="dish-price">{formatPrice(item.price, lang)}</span>}
            {item.weight_value != null && item.weight_value !== '' && (
              <span className="dish-weight">
                {item.weight_value} {item.weight_unit || ''}
              </span>
            )}
          </div>
          {desc && <p className="dish-desc">{desc}</p>}
          {hasKbju && (
            <div className="dish-nutri">
              <div className="dish-nutri-label">{t.nutrition}</div>
              <div className="dish-nutri-grid">
                <NutriCard value={k.calories} label={t.kcal} />
                <NutriCard value={k.protein} label={t.protein} />
                <NutriCard value={k.fat} label={t.fat} />
                <NutriCard value={k.carbs} label={t.carbs} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NutriCard({ value, label }) {
  return (
    <div className="dish-nutri-card">
      <span className="dish-nutri-value">{value != null && value !== '' ? value : '—'}</span>
      <span className="dish-nutri-name">{label}</span>
    </div>
  )
}
