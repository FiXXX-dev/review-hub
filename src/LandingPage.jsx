import React, { useEffect, useRef, useState } from 'react'
import {
  Wifi,
  BookOpen,
  BellRing,
  Car,
  Calendar,
  BarChart3,
  MapPin,
  Send,
  Phone,
} from 'lucide-react'

// ─── Контакты halo ───
const TELEGRAM_URL = 'https://t.me/bangbangrs'
const PHONE = '+998 95 183-66-36'

const FEATURES = [
  { Icon: Wifi, text: 'Wi-Fi без вопросов персоналу' },
  { Icon: BookOpen, text: 'Меню и прайс' },
  { Icon: BellRing, text: 'Обслуживание номера' },
  { Icon: Car, text: 'Вызов такси' },
  { Icon: Calendar, text: 'Запись на приём' },
  { Icon: BarChart3, text: 'Статистика сканов' },
]

const PROBLEMS = [
  'Одна единица в Яндексе стоит вам десятков клиентов',
  'Довольные гости молчат — они просто уходят',
  'О проблеме вы узнаёте последним',
]

const STEPS = [
  'Гость прикладывает телефон к табличке',
  'Открывается страница вашего заведения',
  'Ставит оценку',
  'Хорошая — уходит на карты. Плохая — приходит вам в Telegram за 3 секунды',
]

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Дуги halo — графический мотив (разделитель секций) */
function ArcDivider() {
  return (
    <svg className="lp-arcs" viewBox="0 0 100 56" aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        <path d="M14 52 A38 38 0 1 1 86 52" strokeWidth="5" />
        <path d="M27 50 A25 25 0 1 1 73 50" strokeWidth="5" />
        <path d="M39 48 A12 12 0 1 1 61 48" strokeWidth="5" />
      </g>
    </svg>
  )
}

/* ─── Живая развилка: телефон + пути на карты / в Telegram ─── */
function HeroFork() {
  const [stars, setStars] = useState(0) // 0 = idle
  const interacted = useRef(false)
  const timers = useRef([])

  const state = stars === 0 ? 'idle' : stars >= 4 ? 'good' : 'bad'

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function pick(n) {
    interacted.current = true
    clearTimers()
    setStars(n)
  }

  // автопрокрутка: 4 секунды тишины → сценарий 2★ → сброс
  useEffect(() => {
    if (REDUCED()) {
      setStars(2) // статика: сразу показываем перехват
      return
    }
    if (interacted.current) return
    if (state === 'idle') {
      timers.current.push(
        setTimeout(() => {
          if (!interacted.current) setStars(2)
        }, 4000)
      )
    } else {
      timers.current.push(
        setTimeout(() => {
          if (!interacted.current) setStars(0)
        }, 3600)
      )
    }
    return clearTimers
  }, [state])

  const starEls = [1, 2, 3, 4, 5].map((n) => (
    <button
      key={n}
      type="button"
      className={`lp-star ${stars >= n ? 'on' : ''}`}
      onClick={() => pick(n)}
      aria-label={`Оценка ${n} из 5`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />
      </svg>
    </button>
  ))

  return (
    <div className={`lp-fork lp-fork-${state}`}>
      {/* рельсы: десктоп — влево/вниз от телефона */}
      <div className="lp-rails lp-rails-desktop" aria-hidden="true">
        <svg viewBox="0 0 230 560" preserveAspectRatio="none">
          <path className="lp-rail-bg" d="M226 250 C 150 250, 130 120, 62 120" />
          <path className="lp-rail-bg" d="M226 270 C 150 270, 140 430, 62 430" />
          <path className="lp-rail lp-rail-good" pathLength="1" d="M226 250 C 150 250, 130 120, 62 120" />
          <path className="lp-rail lp-rail-bad" pathLength="1" d="M226 270 C 150 270, 140 430, 62 430" />
        </svg>
        <div className="lp-node lp-node-maps" style={{ left: 14, top: 96 }}>
          <MapPin size={22} strokeWidth={1.9} />
        </div>
        <div className="lp-node lp-node-tg" style={{ left: 14, top: 406 }}>
          <Send size={20} strokeWidth={1.9} />
        </div>
        <div className="lp-rail-label lp-label-good" style={{ left: 0, top: 148 }}>
          Отзыв ушёл на карты
        </div>
        <div className="lp-rail-label lp-label-bad" style={{ left: 0, top: 458 }}>
          Жалоба перехвачена · не попала в интернет
        </div>
      </div>

      {/* телефон */}
      <div className="lp-phone">
        <div className="lp-phone-screen">
          <div className="lp-screen-head">
            <span className="lp-screen-dot" />
            Кофейня «Демо»
          </div>
          <div className="lp-screen-title">Оцените нас</div>
          <div className="lp-stars" role="group" aria-label="Поставьте оценку">
            {starEls}
          </div>

          {state === 'idle' && <p className="lp-screen-hint">Тапните звёзды — попробуйте сами</p>}

          {state === 'good' && (
            <div className="lp-screen-panel">
              <p className="lp-screen-mono">Спасибо! Поделитесь оценкой:</p>
              <div className="lp-mini-btn">
                <span className="lp-dot" style={{ background: '#FC3F1D' }} />
                Яндекс.Карты
              </div>
              <div className="lp-mini-btn">
                <span className="lp-dot" style={{ background: '#4285F4' }} />
                Google Карты
              </div>
              <div className="lp-mini-btn">
                <span className="lp-dot" style={{ background: '#19AA1E' }} />
                2ГИС
              </div>
            </div>
          )}

          {state === 'bad' && (
            <div className="lp-screen-panel">
              <p className="lp-screen-mono">Что пошло не так?</p>
              <div className="lp-mini-input">Кофе остыл, ждали 20 минут…</div>
              <div className="lp-mini-btn lp-mini-btn-solid">Отправить владельцу</div>
            </div>
          )}
        </div>
      </div>

      {/* рельсы: мобильный — вниз от телефона */}
      <div className="lp-rails lp-rails-mobile" aria-hidden="true">
        <svg viewBox="0 0 320 120" preserveAspectRatio="none">
          <path className="lp-rail-bg" d="M150 0 C 150 60, 70 50, 64 104" />
          <path className="lp-rail-bg" d="M170 0 C 170 60, 250 50, 256 104" />
          <path className="lp-rail lp-rail-good" pathLength="1" d="M150 0 C 150 60, 70 50, 64 104" />
          <path className="lp-rail lp-rail-bad" pathLength="1" d="M170 0 C 170 60, 250 50, 256 104" />
        </svg>
        <div className="lp-mnode lp-node lp-node-maps">
          <MapPin size={20} strokeWidth={1.9} />
        </div>
        <div className="lp-mnode lp-node lp-node-tg">
          <Send size={18} strokeWidth={1.9} />
        </div>
        <div className="lp-mlabel lp-rail-label lp-label-good">Отзыв ушёл на карты</div>
        <div className="lp-mlabel lp-rail-label lp-label-bad">
          Жалоба перехвачена · не попала в интернет
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  useEffect(() => {
    document.title = 'halo — плохой отзыв не должен попасть в интернет'
    // шрифты нужны только лендингу — грузим при монтировании
    if (!document.getElementById('lp-fonts')) {
      const link = document.createElement('link')
      link.id = 'lp-fonts'
      link.rel = 'stylesheet'
      link.href =
        'https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  const base = import.meta.env.BASE_URL

  return (
    <div className="lp">
      {/* ─── HERO ─── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <div className="lp-logo">
              <img src={`${base}halo.svg`} alt="halo" />
              halo
            </div>
            <h1 className="lp-display">
              Плохой отзыв не должен попасть в&nbsp;интернет
            </h1>
            <p className="lp-hero-sub">
              Гость прикладывает телефон к табличке. Доволен — идёт оставлять отзыв на картах.
              Недоволен — пишет вам напрямую, а не в Google.
            </p>
            <div className="lp-cta">
              <a className="lp-btn lp-btn-solid" href={`${base}v/demo`}>
                Открыть демо
              </a>
              <a className="lp-btn lp-btn-ghost" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
                Написать в Telegram
              </a>
            </div>
          </div>
          <HeroFork />
        </div>
      </section>

      {/* ─── ПРОБЛЕМА ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Проблема</div>
        <div className="lp-problems">
          {PROBLEMS.map((p) => (
            <p className="lp-display lp-problem" key={p}>
              {p}
            </p>
          ))}
        </div>
      </section>

      <ArcDivider />

      {/* ─── КАК РАБОТАЕТ ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Как это работает</div>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={i}>
              <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="lp-step-text">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <ArcDivider />

      {/* ─── ЧТО ЕЩЁ УМЕЕТ ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Что ещё умеет</div>
        <div className="lp-features">
          {FEATURES.map(({ Icon, text }) => (
            <div className="lp-feature" key={text}>
              <Icon size={20} strokeWidth={1.8} />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <ArcDivider />

      {/* ─── ДЛЯ КОГО ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Для кого</div>
        <p className="lp-display lp-audience">
          Отели · Кафе · Барбершопы · Клиники · Автосервисы
        </p>
      </section>

      {/* ─── КОНТАКТ ─── */}
      <section className="lp-section lp-contact">
        <h2 className="lp-display">Покажем на вашем заведении за 10 минут</h2>
        <div className="lp-cta">
          <a className="lp-btn lp-btn-solid" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            <Send size={18} strokeWidth={2} /> Написать в Telegram
          </a>
          <a className="lp-btn lp-btn-ghost" href={`tel:${PHONE.replace(/[^+\d]/g, '')}`}>
            <Phone size={18} strokeWidth={2} /> {PHONE}
          </a>
        </div>
      </section>

      <footer className="lp-footer">halo · Ташкент · gethalo.uz</footer>
    </div>
  )
}
