import React, { useEffect, useState, useRef } from 'react'
import {
  Sparkles, Bed, GlassWater, Clock, Wrench, Car, Coffee, Shirt, BellRing,
  Star, Wifi, MapPin, Phone, BookOpen, Calendar, Info, Send, Camera,
  Scissors, Stethoscope, ShoppingBag, Wallet,
} from 'lucide-react'
import { supabase } from './lib/supabase.js'
import {
  blockUrl,
  resolveBlocks,
  orderPlatforms,
  SERVICE_OPTIONS,
  DEFAULT_TAXI_CLASSES,
  formatPrice,
  serviceTitle,
} from './lib/blocks.js'
import { useLang, useT, LangSwitch } from './lib/i18n.jsx'
import { HaloIcon } from './lib/logo.jsx'

// Иконки услуг: ключ хранится в services.icon (или в ключе плитки).
// Неизвестное значение рендерится как текст (эмодзи), пусто — колокольчик.
const SERVICE_ICONS = {
  cleaning: Sparkles,
  towels: Bed,
  water: GlassWater,
  breakfast: Coffee,
  laundry: Shirt,
  late_checkout: Clock,
  broken: Wrench,
  taxi: Car,
  bell: BellRing,
}

// Иконки кнопок блоков: только lucide, эмодзи из пресетов игнорируются
const BLOCK_TYPE_ICONS = {
  rating: Star,
  wifi: Wifi,
  service: BellRing,
  services: BellRing,
  taxi: Car,
  contacts: MapPin,
  phone: Phone,
  menu: BookOpen,
  appointment: Calendar,
  price: Wallet,
  doctors: Stethoscope,
  masters: Scissors,
  catalog: ShoppingBag,
  instagram: Camera,
  telegram: Send,
  info: Info,
}

function BlockIcon({ type, size = 22 }) {
  const Ic = BLOCK_TYPE_ICONS[type] ?? Info
  return <Ic size={size} strokeWidth={1.9} className="btn-icon" />
}

function SvcIcon({ icon, size = 22 }) {
  const Ic = SERVICE_ICONS[icon]
  if (Ic) return <Ic className="service-icon" size={size} strokeWidth={1.8} />
  if (icon) return <span className="svc-icon">{icon}</span>
  return <BellRing className="service-icon" size={size} strokeWidth={1.8} />
}

const PLATFORMS = [
  { key: 'yandex', label: 'Яндекс.Карты', urlField: 'yandex_review_url', color: '#FC3F1D' },
  { key: 'google', label: 'Google Карты', urlField: 'google_review_url', color: '#4285F4' },
  { key: '2gis', label: '2ГИС', urlField: 'gis2_review_url', color: '#19AA1E' },
]

// Уведомление — best effort, посетителя не блокируем.
// Сначала пробуем собственный бэкенд (Railway), если его нет
// (на GitHub Pages) — Supabase Edge Function 'notify'.
async function notifyApi(payload) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
    if (!res.ok) throw new Error(`api/notify ${res.status}`)
  } catch {
    try {
      await supabase?.functions.invoke('notify', { body: payload })
    } catch {
      // некому слать — данные всё равно уже в базе
    }
  }
}

// фон/лого из админки — абсолютные ссылки (Storage); из репо — относительные,
// резолвим от базового URL, чтобы смена домена ничего не ломала
function resolveAssetUrl(u) {
  if (!u) return null
  return u.startsWith('http') || u.startsWith('/') ? u : import.meta.env.BASE_URL + u
}

export default function VenuePage({ slug }) {
  const { lang } = useLang()
  const t = useT()
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bgLoaded, setBgLoaded] = useState(false)
  const scanLogged = useRef(false)

  // ?room=204 — номер комнаты (QR в номере отеля), уходит во все заявки
  const [room, setRoom] = useState(
    () => new URLSearchParams(window.location.search).get('room')?.trim().slice(0, 20) || ''
  )

  const bgUrl = resolveAssetUrl(venue?.background_image_url)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }
      // anon видит только публичные колонки (pairing_code закрыт грантами),
      // поэтому явный список; фолбэки — на случай неприменённых миграций
      const VENUE_COLUMNS =
        'id, slug, name, logo_url, welcome_text, yandex_review_url, google_review_url, ' +
        'gis2_review_url, menu_url, wifi_ssid, wifi_password, instagram_url, telegram_url, ' +
        'phone, address, accent_color, text_color, background_image_url, preset_key, ' +
        'enabled_blocks, block_links, service_options, rating_platform_order, taxi_classes'
      let { data, error } = await supabase
        .from('venues')
        .select(`${VENUE_COLUMNS}, preset:presets(*)`)
        .eq('slug', slug)
        .maybeSingle()
      if (error) {
        ;({ data, error } = await supabase
          .from('venues')
          .select(VENUE_COLUMNS)
          .eq('slug', slug)
          .maybeSingle())
      }
      if (error) {
        ;({ data } = await supabase.from('venues').select('*').eq('slug', slug).maybeSingle())
      }
      if (cancelled) return
      setVenue(data ?? null)
      setLoading(false)
      if (data && !scanLogged.current) {
        scanLogged.current = true
        supabase.from('scans').insert({ venue_id: data.id }).then(() => {})
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (venue?.accent_color) {
      document.documentElement.style.setProperty('--accent', venue.accent_color)
    }
    if (venue?.text_color) {
      document.documentElement.style.setProperty('--text', venue.text_color)
    }
    if (venue?.name) {
      document.title = venue.name
    }
  }, [venue])

  // фон появляется плавно и только после полной загрузки — без мигания
  useEffect(() => {
    if (!bgUrl) return
    const img = new Image()
    img.onload = () => setBgLoaded(true)
    img.src = bgUrl
  }, [bgUrl])

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
          <h1>{t('notfound_title')}</h1>
          <p>{t('notfound_sub')}</p>
        </div>
      </div>
    )
  }

  const blocks = resolveBlocks(venue, lang)

  // подряд идущие instagram/telegram схлопываем в компактный ряд
  const rendered = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'instagram' || b.type === 'telegram') {
      const group = [b]
      while (
        i + 1 < blocks.length &&
        (blocks[i + 1].type === 'instagram' || blocks[i + 1].type === 'telegram')
      ) {
        group.push(blocks[++i])
      }
      const visible = group.filter((g) => venue[`${g.type}_url`])
      if (visible.length) {
        rendered.push(
          <div className="socials" key={`socials-${i}`}>
            {visible.map((g) => (
              <a
                key={g.type}
                className="btn btn-social"
                href={venue[`${g.type}_url`]}
                target="_blank"
                rel="noreferrer"
              >
                <BlockIcon type={g.type} size={18} /> {g.label}
              </a>
            ))}
          </div>
        )
      }
      continue
    }
    const el = renderBlock(b, venue, room, setRoom)
    if (el) rendered.push(el)
  }

  return (
    <div className={`page ${bgUrl ? 'with-bg' : ''}`}>
      {bgUrl && (
        <div
          className="bg-layer"
          style={{ backgroundImage: `url(${bgUrl})`, opacity: bgLoaded ? 1 : 0 }}
          aria-hidden="true"
        />
      )}
      <div className="container">
        <LangSwitch className="venue-lang" />
        <header className="header">
          {venue.logo_url && (
            <img
              className="logo"
              src={venue.logo_url}
              alt=""
              onError={(e) => {
                // битая ссылка на лого не должна портить страницу
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <h1 className="venue-name">{venue.name}</h1>
          {venue.welcome_text && <p className="welcome">{venue.welcome_text}</p>}
        </header>

        <main className="actions">{rendered}</main>

        <footer className="footer">
          {venue.address && <div>{venue.address}</div>}
          {venue.phone && (
            <div>
              <a href={`tel:${venue.phone}`}>{venue.phone}</a>
            </div>
          )}
          <div className="powered">
            {t('powered')}{' '}
            <span className="halo-brand">
              <HaloIcon className="halo-mark" size={13} strokeWidth={11} />
              halo
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function renderBlock(block, venue, room, setRoom) {
  const { type } = block
  switch (type) {
    case 'rating':
      return <RatingBlock key={type} block={block} venue={venue} room={room} />
    case 'wifi':
      return venue.wifi_ssid ? <WifiBlock key={type} block={block} venue={venue} /> : null
    case 'appointment':
      return <AppointmentBlock key={type} block={block} venue={venue} room={room} />
    case 'service':
    case 'services':
      // одна реализация: плитки с ценами из каталога services
      return (
        <ServicesCatalogBlock key={type} block={block} venue={venue} room={room} setRoom={setRoom} />
      )
    case 'taxi':
      return <TaxiBlock key={type} block={block} venue={venue} room={room} setRoom={setRoom} />
    case 'contacts':
      return venue.address || venue.phone ? (
        <ContactsBlock key={type} block={block} venue={venue} />
      ) : null
    case 'phone':
      return venue.phone ? (
        <a key={type} className="btn btn-secondary" href={`tel:${venue.phone}`}>
          <BlockIcon type={block.type} /> {block.label}
        </a>
      ) : null
    default: {
      // универсальный link-блок: иконка + подпись + url
      const url = blockUrl(venue, type)
      return url ? (
        <a key={type} className="btn btn-secondary" href={url} target="_blank" rel="noreferrer">
          <BlockIcon type={block.type} /> {block.label}
        </a>
      ) : null
    }
  }
}

/* ─── Оценка (ядро продукта) ─── */
function RatingBlock({ block, venue, room }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [ratingId, setRatingId] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [feedbackContact, setFeedbackContact] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const insertPending = useRef(false)

  // у отелей Google первым — порядок задаёт venues.rating_platform_order
  const availablePlatforms = orderPlatforms(
    PLATFORMS.filter((p) => venue[p.urlField]),
    venue
  )

  async function pickStars(n) {
    setStars(n)
    // оценка пишется в ratings сразу при выборе звёзд;
    // повторный выбор обновляет ту же строку (RPC), а не плодит новые
    if (ratingId) {
      supabase.rpc('rating_set_stars', { p_rating_id: ratingId, p_stars: n })
      return
    }
    if (insertPending.current) return
    insertPending.current = true
    const { data } = await supabase
      .from('ratings')
      .insert({ venue_id: venue.id, stars: n, room: room || null })
      .select('id')
      .single()
    insertPending.current = false
    if (data) setRatingId(data.id)
  }

  async function goToPlatform(platform) {
    const url = venue[platform.urlField]
    // redirected_to пишем до ухода со страницы (anon не имеет update — RPC)
    if (ratingId) {
      await supabase.rpc('rating_set_redirect', { p_rating_id: ratingId, p_platform: platform.key })
    }
    await notifyApi({ venue_id: venue.id, rating_id: ratingId, stars, platform: platform.key })
    window.location.href = url
  }

  async function submitFeedback(e) {
    e.preventDefault()
    if (!feedbackMsg.trim() || sending) return
    setSending(true)
    await supabase.from('feedback').insert({
      venue_id: venue.id,
      stars,
      message: feedbackMsg.trim(),
      contact: feedbackContact.trim() || null,
      room: room || null,
    })
    await notifyApi({
      venue_id: venue.id,
      stars,
      message: feedbackMsg.trim(),
      contact: feedbackContact.trim() || null,
      room: room || null,
    })
    setSending(false)
    setDone(true)
  }

  if (!open) {
    return (
      <button className="btn btn-primary btn-big" onClick={() => setOpen(true)}>
        <BlockIcon type={block.type} /> {block.label}
      </button>
    )
  }

  return (
    <div className="card rating-card">
      {done ? (
        <div className="thanks">
          <div className="thanks-emoji">🙏</div>
          <p className="thanks-title">{t('thanks')}</p>
          <p className="thanks-sub">{t('owner_got')}</p>
        </div>
      ) : (
        <>
          <div className="stars-row">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`star ${stars >= n ? 'star-on' : ''}`}
                onClick={() => pickStars(n)}
                aria-label={`${n} из 5`}
              >
                ★
              </button>
            ))}
          </div>

          {stars >= 4 && (
            <div className="after-stars">
              <p className="after-title">{t('share_rating')}</p>
              <div className="platforms">
                {availablePlatforms.map((p) => (
                  <button key={p.key} className="btn btn-platform" onClick={() => goToPlatform(p)}>
                    <span className="platform-dot" style={{ background: p.color }} /> {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stars >= 1 && stars <= 3 && (
            <form className="after-stars feedback-form" onSubmit={submitFeedback}>
              <textarea
                placeholder={t('feedback_ph')}
                value={feedbackMsg}
                onChange={(e) => setFeedbackMsg(e.target.value)}
                rows={4}
                required
              />
              <input
                type="text"
                placeholder={t('contact_ph')}
                value={feedbackContact}
                onChange={(e) => setFeedbackContact(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={sending || !feedbackMsg.trim()}
              >
                {sending ? t('sending') : t('send')}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Wi-Fi ─── */
function WifiBlock({ block, venue }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(venue.wifi_password)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = venue.wifi_password
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        <BlockIcon type={block.type} /> {block.label}
      </button>
      {open && (
        <div className="card wifi-card">
          <div className="wifi-row">
            <span className="wifi-label">{t('network')}</span>
            <span className="wifi-value">{venue.wifi_ssid}</span>
          </div>
          {venue.wifi_password && (
            <>
              <div className="wifi-row">
                <span className="wifi-label">{t('password')}</span>
                <span className="wifi-value">{venue.wifi_password}</span>
              </div>
              <button className="btn btn-copy" onClick={copyPassword}>
                {copied ? t('copied') : t('copy_pass')}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Запись (имя, телефон, услуга, время) ─── */
function AppointmentBlock({ block, venue, room }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [service, setService] = useState('')
  const [time, setTime] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (sending || !name.trim() || !phone.trim()) return
    setSending(true)
    const row = {
      venue_id: venue.id,
      name: name.trim(),
      phone: phone.trim(),
      service: service.trim() || null,
      preferred_time: time.trim() || null,
      room: room || null,
    }
    await supabase.from('appointments').insert(row)
    await notifyApi({ type: 'appointment', ...row })
    setSending(false)
    setDone(true)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        <BlockIcon type={block.type} /> {block.label}
      </button>
      {open && (
        <div className="card">
          {done ? (
            <div className="thanks">
              <div className="thanks-emoji">✅</div>
              <p className="thanks-title">{t('request_sent')}</p>
              <p className="thanks-sub">{t('will_contact')}</p>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={submit}>
              <input
                type="text"
                placeholder={t('your_name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder={t('phone_ph')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder={t('service_ph')}
                value={service}
                onChange={(e) => setService(e.target.value)}
              />
              <input
                type="text"
                placeholder={t('appt_time_ph')}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={sending || !name.trim() || !phone.trim()}
              >
                {sending ? t('sending') : t('book')}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Контакты ─── */
function ContactsBlock({ block, venue }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        <BlockIcon type={block.type} /> {block.label}
      </button>
      {open && (
        <div className="card wifi-card">
          {venue.address && (
            <div className="wifi-row">
              <span className="wifi-label">{t('address')}</span>
              <span className="wifi-value contacts-value">{venue.address}</span>
            </div>
          )}
          {venue.phone && (
            <div className="wifi-row">
              <span className="wifi-label">{t('phone_label')}</span>
              <a className="wifi-value" href={`tel:${venue.phone}`}>
                {venue.phone}
              </a>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Такси: форма вызова ─── */
function TaxiBlock({ block, venue, room, setRoom }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [roomInput, setRoomInput] = useState('')
  const [destination, setDestination] = useState('')
  const classes = Array.isArray(venue.taxi_classes) && venue.taxi_classes.length
    ? venue.taxi_classes
    : DEFAULT_TAXI_CLASSES
  const [carClass, setCarClass] = useState(classes[0])
  const [whenMode, setWhenMode] = useState('now') // 'now' | 'later'
  const [time, setTime] = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const effectiveRoom = (room || roomInput).trim()
  const canSend =
    !sending && destination.trim() && effectiveRoom && (whenMode === 'now' || time.trim())

  async function submit(e) {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    if (!room && roomInput.trim()) setRoom(roomInput.trim().slice(0, 20))
    const row = {
      venue_id: venue.id,
      room: effectiveRoom.slice(0, 20),
      destination: destination.trim().slice(0, 300),
      car_class: carClass,
      when_time: whenMode === 'later' ? time.trim().slice(0, 40) : null,
      comment: comment.trim() ? comment.trim().slice(0, 500) : null,
    }
    await supabase.from('taxi_requests').insert(row)
    await notifyApi({ type: 'taxi', ...row })
    setSending(false)
    setDone(true)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        <BlockIcon type={block.type} /> {block.label}
      </button>
      {open && (
        <div className="card">
          {done ? (
            <div className="thanks">
              <div className="thanks-emoji">🚕</div>
              <p className="thanks-title">{t('request_accepted')}</p>
              <p className="thanks-sub">{t('reception')}</p>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={submit}>
              {!room && (
                <input
                  type="text"
                  placeholder={t('room_number')}
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  required
                />
              )}
              <input
                type="text"
                placeholder={t('where_to')}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
              <div className="chip-row">
                {classes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip ${carClass === c ? 'on' : ''}`}
                    onClick={() => setCarClass(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${whenMode === 'now' ? 'on' : ''}`}
                  onClick={() => setWhenMode('now')}
                >
                  {t('now')}
                </button>
                <button
                  type="button"
                  className={`chip ${whenMode === 'later' ? 'on' : ''}`}
                  onClick={() => setWhenMode('later')}
                >
                  {t('later')}
                </button>
                {whenMode === 'later' && (
                  <input
                    className="chip-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                )}
              </div>
              <textarea
                placeholder={t('comment_ph')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <button className="btn btn-primary" type="submit" disabled={!canSend}>
                {sending ? t('sending') : t('call_taxi')}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Обслуживание номера: плитки с ценами из каталога services ─── */
function ServicesCatalogBlock({ block, venue, room, setRoom }) {
  const t = useT()
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null) // null = ещё не загружали
  const [selected, setSelected] = useState(null)
  const [roomInput, setRoomInput] = useState('')
  const [comment, setComment] = useState('')
  const [time, setTime] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const effectiveRoom = (room || roomInput).trim()

  useEffect(() => {
    if (!open || items !== null) return
    supabase
      .from('services')
      .select('*')
      .eq('venue_id', venue.id)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error || !data?.length) {
          // каталог пуст (или миграция не применена) — плитки быстрых
          // запросов по-старому, из встроенного списка
          setItems(
            SERVICE_OPTIONS.filter(
              (o) => !Array.isArray(venue.service_options) || venue.service_options.includes(o.key)
            ).map((o) => ({
              id: o.key,
              title_ru: o.label_ru,
              title_en: o.label_en,
              icon: o.key,
              price: null,
              is_free: false, // без бейджа цены в легаси-режиме
              require_comment: !!o.comment,
              legacy: true,
            }))
          )
          return
        }
        setItems(data)
      })
  }, [open, items, venue.id, venue.service_options])

  function priceLabel(s) {
    if (s.legacy) return null
    if (s.is_free || s.price == null) return t('free')
    return formatPrice(s.price, lang)
  }

  function pick(s) {
    setSelected(s)
    setComment('')
    setTime('')
  }

  async function submit(e) {
    e.preventDefault()
    if (sending || !selected || !effectiveRoom) return
    if (selected.require_comment && !comment.trim()) return
    setSending(true)
    if (!room && roomInput.trim()) setRoom(roomInput.trim().slice(0, 20))
    const row = {
      venue_id: venue.id,
      room: effectiveRoom.slice(0, 20),
      request_type: selected.legacy ? selected.id : selected.title_ru,
      comment: comment.trim() ? comment.trim().slice(0, 500) : null,
      preferred_time: time.trim() ? time.trim().slice(0, 40) : null,
    }
    await supabase.from('service_requests').insert(row)
    await notifyApi({ type: 'service', ...row, price_label: priceLabel(selected) })
    setSending(false)
    setDone(true)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        <BlockIcon type={block.type} /> {block.label}
      </button>
      {open && (
        <div className="card">
          {done ? (
            <div className="thanks">
              <div className="thanks-emoji">🛎️</div>
              <p className="thanks-title">{t('request_accepted')}</p>
              <p className="thanks-sub">{t('coming')}</p>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setDone(false)
                  setSelected(null)
                }}
              >
                {t('order_more')}
              </button>
            </div>
          ) : items === null ? (
            <div className="spinner" style={{ margin: '12px auto' }} />
          ) : items.length === 0 ? (
            <p className="service-hint">{t('empty_services')}</p>
          ) : !selected ? (
            <div className="service-body">
              {!room && (
                <input
                  className="service-room-input"
                  type="text"
                  placeholder={t('room_number')}
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                />
              )}
              {room && <p className="service-room-label">{t('room')} {room}</p>}
              <div className="service-grid">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="service-tile"
                    disabled={!effectiveRoom}
                    onClick={() => pick(s)}
                  >
                    <SvcIcon icon={s.icon} />
                    <span>{serviceTitle(s, lang)}</span>
                    {priceLabel(s) && (
                      <span
                        className={`service-tile-price ${
                          s.is_free || s.price == null ? 'free' : ''
                        }`}
                      >
                        {priceLabel(s)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {!effectiveRoom && <p className="service-hint">{t('room_hint')}</p>}
            </div>
          ) : (
            <form className="feedback-form" onSubmit={submit}>
              <div className="svc-selected">
                <span className="svc-title">
                  <SvcIcon icon={selected.icon} size={18} />
                  {serviceTitle(selected, lang)}
                </span>
                {priceLabel(selected) && (
                  <span
                    className={`svc-price ${
                      selected.is_free || selected.price == null ? 'free' : ''
                    }`}
                  >
                    {priceLabel(selected)}
                  </span>
                )}
              </div>
              <textarea
                placeholder={selected.require_comment ? t('broken_ph') : t('comment_ph')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                required={selected.require_comment}
              />
              <input
                type="text"
                placeholder={t('svc_time_ph')}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  sending || !effectiveRoom || (selected.require_comment && !comment.trim())
                }
              >
                {sending ? t('sending') : t('order')}
              </button>
              <button type="button" className="btn-link" onClick={() => setSelected(null)}>
                {t('back_list')}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  )
}
