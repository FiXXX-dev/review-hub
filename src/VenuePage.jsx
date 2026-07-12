import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase.js'

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

export default function VenuePage({ slug }) {
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)

  // rating flow: idle → stars → platforms | form → done
  const [ratingOpen, setRatingOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [ratingId, setRatingId] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [feedbackContact, setFeedbackContact] = useState('')
  const [sending, setSending] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  const [wifiOpen, setWifiOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const scanLogged = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('venues')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
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
    if (venue?.name) {
      document.title = venue.name
    }
  }, [venue])

  const ratingInsertPending = useRef(false)

  async function pickStars(n) {
    setStars(n)
    if (!venue) return
    // оценка пишется в ratings сразу при выборе звёзд;
    // повторный выбор обновляет ту же строку (RPC), а не плодит новые
    if (ratingId) {
      supabase.rpc('rating_set_stars', { p_rating_id: ratingId, p_stars: n })
      return
    }
    if (ratingInsertPending.current) return
    ratingInsertPending.current = true
    const { data } = await supabase
      .from('ratings')
      .insert({ venue_id: venue.id, stars: n })
      .select('id')
      .single()
    ratingInsertPending.current = false
    if (data) setRatingId(data.id)
  }

  async function goToPlatform(platform) {
    const url = venue[platform.urlField]
    // redirected_to пишем до ухода со страницы (anon не имеет update — RPC)
    if (ratingId) {
      await supabase.rpc('rating_set_redirect', { p_rating_id: ratingId, p_platform: platform.key })
    }
    await notifyApi({
      venue_id: venue.id,
      rating_id: ratingId,
      stars,
      platform: platform.key,
    })
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
    })
    await notifyApi({
      venue_id: venue.id,
      stars,
      message: feedbackMsg.trim(),
      contact: feedbackContact.trim() || null,
    })
    setSending(false)
    setFeedbackDone(true)
  }

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

  const availablePlatforms = PLATFORMS.filter((p) => venue[p.urlField])
  // enabled_blocks: null/пусто = показывать всё (по наличию данных)
  const blockOn = (b) => !venue.enabled_blocks?.length || venue.enabled_blocks.includes(b)
  const showRating = blockOn('rating')
  const showMenu = blockOn('menu') && venue.menu_url
  const showWifi = blockOn('wifi') && venue.wifi_ssid
  const showInstagram = blockOn('instagram') && venue.instagram_url
  const showTelegram = blockOn('telegram') && venue.telegram_url

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          {venue.logo_url && <img className="logo" src={venue.logo_url} alt={venue.name} />}
          <h1 className="venue-name">{venue.name}</h1>
          {venue.welcome_text && <p className="welcome">{venue.welcome_text}</p>}
        </header>

        <main className="actions">
          {/* ─── Оценка ─── */}
          {showRating &&
          (!ratingOpen ? (
            <button className="btn btn-primary btn-big" onClick={() => setRatingOpen(true)}>
              ⭐ Оценить нас
            </button>
          ) : (
            <div className="card rating-card">
              {feedbackDone ? (
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
                          <button
                            key={p.key}
                            className="btn btn-platform"
                            onClick={() => goToPlatform(p)}
                          >
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
          ))}

          {/* ─── Меню ─── */}
          {showMenu && (
            <a className="btn btn-secondary" href={venue.menu_url} target="_blank" rel="noreferrer">
              📖 Меню
            </a>
          )}

          {/* ─── Wi-Fi ─── */}
          {showWifi && (
            <>
              <button className="btn btn-secondary" onClick={() => setWifiOpen(!wifiOpen)}>
                📶 Wi-Fi
              </button>
              {wifiOpen && (
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
          )}

          {/* ─── Соцсети ─── */}
          {(showInstagram || showTelegram) && (
            <div className="socials">
              {showInstagram && (
                <a className="btn btn-social" href={venue.instagram_url} target="_blank" rel="noreferrer">
                  📷 Instagram
                </a>
              )}
              {showTelegram && (
                <a className="btn btn-social" href={venue.telegram_url} target="_blank" rel="noreferrer">
                  ✈️ Telegram
                </a>
              )}
            </div>
          )}
        </main>

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
