import React, { useEffect, useRef, useState } from 'react'
import {
  Wifi,
  BookOpen,
  Star,
  BellRing,
  Car,
  BarChart3,
  Calendar,
  Send,
  Phone,
} from 'lucide-react'

// ─── Контакты halo ───
const TELEGRAM_URL = 'https://t.me/bangbangrs'
const PHONE = '+998 95 183-66-36'

const FAN = [
  { Icon: Wifi, label: 'Wi-Fi' },
  { Icon: BookOpen, label: 'Меню' },
  { Icon: Star, label: 'Отзывы' },
  { Icon: BellRing, label: 'Обслуживание' },
  { Icon: Car, label: 'Такси' },
  { Icon: BarChart3, label: 'Статистика' },
]

const CAPABILITIES = [
  { Icon: Wifi, title: 'Wi-Fi', text: 'Гость подключается сам — персонал не диктует пароль' },
  { Icon: BookOpen, title: 'Меню и прайс', text: 'Всегда актуальные, без печати и переклейки' },
  { Icon: Star, title: 'Отзывы с фильтром', text: 'Хорошие — на карты, плохие — лично вам' },
  { Icon: BellRing, title: 'Обслуживание номера', text: 'Уборка, полотенца, завтрак — в два касания' },
  { Icon: Car, title: 'Вызов такси', text: 'Заявка уходит на ресепшен мгновенно' },
  { Icon: Calendar, title: 'Запись на приём', text: 'Для салонов, клиник и автосервисов' },
  { Icon: BarChart3, title: 'Статистика', text: 'Сканы, оценки и заявки — в цифрах' },
]

const STEPS = [
  'Гость прикладывает телефон к табличке',
  'Открывается страница вашего заведения — без приложений',
  'Wi-Fi, меню, заявки и отзывы — всё в одном месте',
]

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const NO_HOVER = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

/* Дуги halo */
function Arcs({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 56" aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        <path d="M14 52 A38 38 0 1 1 86 52" strokeWidth="5" />
        <path d="M27 50 A25 25 0 1 1 73 50" strokeWidth="5" />
        <path d="M39 48 A12 12 0 1 1 61 48" strokeWidth="5" />
      </g>
    </svg>
  )
}

/* ─── Сигнатура: физический тег ─── */
function HeroTag() {
  const [open, setOpen] = useState(false)
  const [burst, setBurst] = useState(0)
  const touched = useRef(false)
  const timers = useRef([])
  const sceneRef = useRef(null)
  const tagRef = useRef(null)

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function activate(auto = false) {
    if (!auto) touched.current = true
    clearTimers()
    setBurst((b) => b + 1)
    setOpen(true)
    // через 5 секунд бездействия — мягко сворачивается
    timers.current.push(setTimeout(() => setOpen(false), 5000))
  }

  // автозапуск: один раз через 3 секунды, если не тапнули
  useEffect(() => {
    if (REDUCED()) {
      setOpen(true) // статика: показываем разложенные карточки
      return
    }
    const t = setTimeout(() => {
      if (!touched.current) activate(true)
    }, 3000)
    return () => {
      clearTimeout(t)
      clearTimers()
    }
  }, [])

  // 3D-наклон за курсором (только там, где есть курсор)
  function onMove(e) {
    if (NO_HOVER() || REDUCED() || !tagRef.current || !sceneRef.current) return
    const r = sceneRef.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    tagRef.current.style.transform = `rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg)`
  }

  function onLeave() {
    if (tagRef.current) tagRef.current.style.transform = ''
  }

  return (
    <div className="lp-scene" ref={sceneRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      {/* волны от касания */}
      {burst > 0 && (
        <span key={burst} className="lp-waves" aria-hidden="true">
          <i />
          <i style={{ animationDelay: '120ms' }} />
          <i style={{ animationDelay: '240ms' }} />
        </span>
      )}

      {/* орбита возможностей: разлетаются по кругу и вращаются вокруг таблички */}
      <div className={`lp-fan ${open ? 'open' : ''}`} aria-hidden={!open}>
        <ul className="lp-ring">
          {FAN.map(({ Icon, label }, i) => (
            <li
              key={label}
              style={{ '--a': `${i * 60}deg`, transitionDelay: open ? `${140 + i * 55}ms` : '0ms' }}
            >
              <span className="lp-pill">
                <Icon size={17} strokeWidth={1.9} />
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* сама табличка (обёртка — лёгкое парение) */}
      <div className="lp-tag-float">
        <button
          type="button"
          className="lp-tag"
          ref={tagRef}
          onClick={() => activate(false)}
          aria-label="Что открывает табличка halo — показать"
        >
          <span className="lp-tag-gloss" aria-hidden="true" />
          <Arcs className="lp-tag-arcs" />
          <span className="lp-tag-caption">Приложите телефон</span>
        </button>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [tStars, setTStars] = useState(0) // звёзды в секции «козырь»

  // плавное появление при скролле (устойчиво к быстрым прыжкам скролла)
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.lp-reveal'))
    if (REDUCED()) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    let ticking = false
    function check() {
      ticking = false
      const limit = window.innerHeight * 0.92
      for (const el of els) {
        if (!el.classList.contains('in') && el.getBoundingClientRect().top < limit) {
          el.classList.add('in')
        }
      }
    }
    function onScroll() {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(check)
      }
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.title = 'halo — умные NFC-таблички для заведений'
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
              <img src={`${base}halo.svg`} alt="" />
              halo
            </div>
            <h1 className="lp-display">Одно касание — и&nbsp;гость получает всё</h1>
            <p className="lp-hero-sub">
              Умная NFC-табличка для заведений: Wi-Fi, меню, отзывы, вызов такси, обслуживание
              номера. Гость прикладывает телефон — и всё открывается за секунду, без приложений.
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
          <HeroTag />
        </div>
      </section>

      {/* ─── ВОЗМОЖНОСТИ ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Что открывается одним касанием</div>
        <ul className="lp-caps">
          {CAPABILITIES.map(({ Icon, title, text }, i) => (
            <li key={title} className="lp-reveal" style={{ transitionDelay: `${i * 45}ms` }}>
              <Icon size={20} strokeWidth={1.8} className="lp-cap-icon" />
              <span className="lp-cap-title">{title}</span>
              <span className="lp-cap-text">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ─── КОЗЫРЬ: ФИЛЬТР ОТЗЫВОВ ─── */}
      <section className="lp-section lp-trump">
        <div className="lp-kicker">Наш козырь</div>
        <h2 className="lp-display lp-reveal">Плохой отзыв не должен попасть в&nbsp;интернет</h2>

        <div className="lp-trump-try lp-reveal">
          <div className="lp-trump-stars" role="group" aria-label="Попробуйте: поставьте оценку">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`lp-tstar ${tStars >= n ? 'on' : ''}`}
                onClick={() => setTStars(n)}
                aria-label={`Оценка ${n} из 5`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />
                </svg>
              </button>
            ))}
          </div>
          <div className="lp-trump-caption" aria-live="polite">
            {tStars === 0 && 'Попробуйте: поставьте оценку'}
            {tStars >= 4 && '→ Яндекс · Google · 2ГИС'}
            {tStars >= 1 && tStars <= 3 && '→ вам в Telegram, не в интернет'}
          </div>
        </div>

        <div className="lp-trump-cols">
          <div className="lp-reveal">
            <div className={`lp-trump-col ${tStars >= 1 && tStars <= 3 ? 'dim' : ''}`}>
              <div className="lp-trump-mark lp-trump-good">4–5★</div>
              <p>
                Довольный гость в одно касание уходит оставлять отзыв на Яндекс, Google или 2ГИС.
              </p>
            </div>
          </div>
          <div className="lp-reveal" style={{ transitionDelay: '60ms' }}>
            <div className={`lp-trump-col ${tStars >= 4 ? 'dim' : ''}`}>
              <div className="lp-trump-mark">1–3★</div>
              <p>
                Недовольный — пишет вам лично в Telegram. За три секунды, пока он ещё за столиком.
                В интернет жалоба не попадает.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── КАК РАБОТАЕТ ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Как это работает</div>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={i} className="lp-reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── ДЛЯ КОГО ─── */}
      <section className="lp-section">
        <div className="lp-kicker">Для кого</div>
        <p className="lp-display lp-audience lp-reveal">Отели · Кафе · Барбершопы · Клиники · Автосервисы</p>
      </section>

      {/* ─── КОНТАКТ ─── */}
      <section className="lp-section lp-contact">
        <Arcs className="lp-contact-arcs" />
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
