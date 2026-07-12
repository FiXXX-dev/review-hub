import React, { useEffect, useState, useRef } from 'react'
import { Sparkles, Bed, GlassWater, Clock, Wrench, Car } from 'lucide-react'
import { supabase } from './lib/supabase.js'
import { blockUrl, resolveBlocks, orderPlatforms, SERVICE_OPTIONS } from './lib/blocks.js'

const SERVICE_ICONS = {
  cleaning: Sparkles,
  towels: Bed,
  water: GlassWater,
  late_checkout: Clock,
  broken: Wrench,
  taxi: Car,
}

const PLATFORMS = [
  { key: 'yandex', label: 'Яндекс.Карты', urlField: 'yandex_review_url', icon: '🟡' },
  { key: 'google', label: 'Google Карты', urlField: 'google_review_url', icon: '🔵' },
  { key: '2gis', label: '2ГИС', urlField: 'gis2_review_url', icon: '🟢' },
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
      // пресет подтягиваем вместе с заведением; если миграция пресетов
      // ещё не применена — фолбэк на плоский select
      let { data, error } = await supabase
        .from('venues')
        .select('*, preset:presets(*)')
        .eq('slug', slug)
        .maybeSingle()
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
          <h1>Заведение не найдено</h1>
          <p>Проверьте ссылку или отсканируйте QR-код ещё раз.</p>
        </div>
      </div>
    )
  }

  const blocks = resolveBlocks(venue)

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
                {g.icon} {g.label}
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
            Работает на{' '}
            <span className="halo-brand">
              <img className="halo-mark" src={`${import.meta.env.BASE_URL}halo.svg`} alt="" />
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
      return (
        <ServiceBlock key={type} block={block} venue={venue} room={room} setRoom={setRoom} />
      )
    case 'contacts':
      return venue.address || venue.phone ? (
        <ContactsBlock key={type} block={block} venue={venue} />
      ) : null
    case 'phone':
      return venue.phone ? (
        <a key={type} className="btn btn-secondary" href={`tel:${venue.phone}`}>
          {block.icon} {block.label}
        </a>
      ) : null
    default: {
      // универсальный link-блок: иконка + подпись + url
      const url = blockUrl(venue, type)
      return url ? (
        <a key={type} className="btn btn-secondary" href={url} target="_blank" rel="noreferrer">
          {block.icon} {block.label}
        </a>
      ) : null
    }
  }
}

/* ─── Оценка (ядро продукта) ─── */
function RatingBlock({ block, venue, room }) {
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
        {block.icon} {block.label}
      </button>
    )
  }

  return (
    <div className="card rating-card">
      {done ? (
        <div className="thanks">
          <div className="thanks-emoji">🙏</div>
          <p className="thanks-title">Спасибо!</p>
          <p className="thanks-sub">Владелец уже получил ваше сообщение.</p>
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
              <p className="after-title">Спасибо! Поделитесь оценкой:</p>
              <div className="platforms">
                {availablePlatforms.map((p) => (
                  <button key={p.key} className="btn btn-platform" onClick={() => goToPlatform(p)}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stars >= 1 && stars <= 3 && (
            <form className="after-stars feedback-form" onSubmit={submitFeedback}>
              <textarea
                placeholder="Расскажите, что было не так — мы исправим"
                value={feedbackMsg}
                onChange={(e) => setFeedbackMsg(e.target.value)}
                rows={4}
                required
              />
              <input
                type="text"
                placeholder="Телефон или имя (по желанию)"
                value={feedbackContact}
                onChange={(e) => setFeedbackContact(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={sending || !feedbackMsg.trim()}
              >
                {sending ? 'Отправляем…' : 'Отправить'}
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
        {block.icon} {block.label}
      </button>
      {open && (
        <div className="card wifi-card">
          <div className="wifi-row">
            <span className="wifi-label">Сеть</span>
            <span className="wifi-value">{venue.wifi_ssid}</span>
          </div>
          {venue.wifi_password && (
            <>
              <div className="wifi-row">
                <span className="wifi-label">Пароль</span>
                <span className="wifi-value">{venue.wifi_password}</span>
              </div>
              <button className="btn btn-copy" onClick={copyPassword}>
                {copied ? '✓ Скопировано' : 'Скопировать пароль'}
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
        {block.icon} {block.label}
      </button>
      {open && (
        <div className="card">
          {done ? (
            <div className="thanks">
              <div className="thanks-emoji">✅</div>
              <p className="thanks-title">Заявка отправлена!</p>
              <p className="thanks-sub">С вами свяжутся для подтверждения.</p>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={submit}>
              <input
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="Телефон"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Услуга (по желанию)"
                value={service}
                onChange={(e) => setService(e.target.value)}
              />
              <input
                type="text"
                placeholder="Удобное время, например: завтра после 15:00"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={sending || !name.trim() || !phone.trim()}
              >
                {sending ? 'Отправляем…' : 'Записаться'}
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
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        {block.icon} {block.label}
      </button>
      {open && (
        <div className="card wifi-card">
          {venue.address && (
            <div className="wifi-row">
              <span className="wifi-label">Адрес</span>
              <span className="wifi-value contacts-value">{venue.address}</span>
            </div>
          )}
          {venue.phone && (
            <div className="wifi-row">
              <span className="wifi-label">Телефон</span>
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

/* ─── Обслуживание номера (отели) ─── */
function ServiceBlock({ block, venue, room, setRoom }) {
  const [open, setOpen] = useState(false)
  const [roomInput, setRoomInput] = useState('')
  const [commentFor, setCommentFor] = useState(null) // ключ запроса с открытым комментарием
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(null) // ключ отправляемого запроса
  const [done, setDone] = useState(false)

  const enabledKeys = Array.isArray(venue.service_options) ? venue.service_options : null
  const options = SERVICE_OPTIONS.filter((o) => !enabledKeys || enabledKeys.includes(o.key))
  const effectiveRoom = room || roomInput.trim()

  async function send(option) {
    if (!effectiveRoom || sending) return
    if (option.comment && commentFor !== option.key) {
      // сначала раскрываем поле комментария, отправка — второй кнопкой
      setCommentFor(option.key)
      return
    }
    setSending(option.key)
    if (!room && roomInput.trim()) setRoom(roomInput.trim().slice(0, 20))
    const row = {
      venue_id: venue.id,
      room: effectiveRoom.slice(0, 20),
      request_type: option.key,
      comment: option.comment && comment.trim() ? comment.trim() : null,
    }
    await supabase.from('service_requests').insert(row)
    await notifyApi({ type: 'service', ...row })
    setSending(null)
    setDone(true)
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
        {block.icon} {block.label}
      </button>
      {open && (
        <div className="card">
          {done ? (
            <div className="thanks">
              <div className="thanks-emoji">🛎️</div>
              <p className="thanks-title">Заявка принята!</p>
              <p className="thanks-sub">Скоро подойдём.</p>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setDone(false)
                  setCommentFor(null)
                  setComment('')
                }}
              >
                Отправить ещё запрос
              </button>
            </div>
          ) : (
            <div className="service-body">
              {!room && (
                <input
                  className="service-room-input"
                  type="text"
                  placeholder="Номер комнаты"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                />
              )}
              {room && <p className="service-room-label">Номер {room}</p>}
              <div className="service-grid">
                {options.map((o) => {
                  const Icon = SERVICE_ICONS[o.key]
                  return (
                    <button
                      key={o.key}
                      type="button"
                      className={`service-tile ${commentFor === o.key ? 'active' : ''}`}
                      disabled={!effectiveRoom || !!sending}
                      onClick={() => send(o)}
                    >
                      {Icon && <Icon className="service-icon" size={22} strokeWidth={1.8} />}
                      <span>{o.label_ru}</span>
                    </button>
                  )
                })}
              </div>
              {!effectiveRoom && (
                <p className="service-hint">Укажите номер комнаты, чтобы отправить запрос</p>
              )}
              {commentFor && (
                <div className="service-comment">
                  <textarea
                    placeholder="Что случилось? Например: не работает кондиционер"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!effectiveRoom || !!sending}
                    onClick={() => send(SERVICE_OPTIONS.find((o) => o.key === commentFor))}
                  >
                    {sending ? 'Отправляем…' : 'Отправить'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
