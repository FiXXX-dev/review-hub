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
import { useLang, LangSwitch } from './lib/i18n.jsx'
import { HaloIcon, HaloLogo } from './lib/logo.jsx'
import { InstagramIcon } from './lib/brand-icons.jsx'

// ─── Контакты halo ───
const TELEGRAM_URL = 'https://t.me/bangbangrs'
const PHONE = '+998 95 183-66-36'
const INSTAGRAM_URL = 'https://www.instagram.com/halonfc/'

// ─── Тексты лендинга (гости и владельцы бывают разные — EN по умолчанию, RU в один тап) ───
const L = {
  en: {
    title: 'halo — smart NFC tags for business | Uzbekistan',
    h1: 'One tap — and your guest gets everything',
    sub: 'A smart NFC tag for venues: Wi-Fi, menu, reviews, taxi, room service. A guest taps their phone — everything opens in a second, no apps.',
    demo: 'Open the demo',
    write_tg: 'Message on Telegram',
    tag_caption: 'Tap your phone',
    tag_aria: 'Show what the halo tag opens',
    fan: ['Wi-Fi', 'Menu', 'Reviews', 'Service', 'Taxi', 'Stats'],
    caps_kicker: 'What opens with one tap',
    caps: [
      ['Wi-Fi', 'Guests connect on their own — no asking the staff'],
      ['Menu & prices', 'Always up to date, no reprinting'],
      ['Reviews with a filter', 'Good ones go to the maps, bad ones come to you'],
      ['Room service', 'Cleaning, towels, breakfast — in two taps'],
      ['Taxi', 'The request reaches the front desk instantly'],
      ['Booking', 'For salons, clinics and car services'],
      ['Analytics', 'Scans, ratings and requests — in numbers'],
    ],
    trump_kicker: 'Our trump card',
    trump_h2: <>A bad review should never reach the&nbsp;internet</>,
    try_hint: 'Try it: leave a rating',
    try_good: '→ Yandex · Google · 2GIS',
    try_bad: '→ to your Telegram, not the internet',
    star_aria: (n) => `Rating ${n} of 5`,
    good_mark: '4–5★',
    good_text: 'A happy guest goes straight to Yandex, Google or 2GIS to leave a review — in one tap.',
    bad_mark: '1–3★',
    bad_text: 'An unhappy one writes to you personally on Telegram. Within three seconds, while they are still at the table. The complaint never reaches the internet.',
    how_kicker: 'How it works',
    steps: [
      'A guest taps their phone on the tag',
      'Your venue page opens — no apps needed',
      'Wi-Fi, menu, requests and reviews — all in one place',
    ],
    who_kicker: 'Who it is for',
    audience: 'Hotels · Cafés · Barbershops · Clinics · Car services',
    contact_h2: 'We will show it at your venue in 10 minutes',
    footer: 'halo · Tashkent · gethalo.uz',
  },
  ru: {
    title: 'halo — умные NFC-таблички для бизнеса | Узбекистан',
    h1: <>Одно касание — и&nbsp;гость получает всё</>,
    sub: 'Умная NFC-табличка для заведений: Wi-Fi, меню, отзывы, вызов такси, обслуживание номера. Гость прикладывает телефон — и всё открывается за секунду, без приложений.',
    demo: 'Открыть демо',
    write_tg: 'Написать в Telegram',
    tag_caption: 'Приложите телефон',
    tag_aria: 'Что открывает табличка halo — показать',
    fan: ['Wi-Fi', 'Меню', 'Отзывы', 'Сервис', 'Такси', 'Статистика'],
    caps_kicker: 'Что открывается одним касанием',
    caps: [
      ['Wi-Fi', 'Гость подключается сам — персонал не диктует пароль'],
      ['Меню и прайс', 'Всегда актуальные, без печати и переклейки'],
      ['Отзывы с фильтром', 'Хорошие — на карты, плохие — лично вам'],
      ['Обслуживание номера', 'Уборка, полотенца, завтрак — в два касания'],
      ['Вызов такси', 'Заявка уходит на ресепшен мгновенно'],
      ['Запись на приём', 'Для салонов, клиник и автосервисов'],
      ['Статистика', 'Сканы, оценки и заявки — в цифрах'],
    ],
    trump_kicker: 'Наш козырь',
    trump_h2: <>Плохой отзыв не должен попасть в&nbsp;интернет</>,
    try_hint: 'Попробуйте: поставьте оценку',
    try_good: '→ Яндекс · Google · 2ГИС',
    try_bad: '→ вам в Telegram, не в интернет',
    star_aria: (n) => `Оценка ${n} из 5`,
    good_mark: '4–5★',
    good_text: 'Довольный гость в одно касание уходит оставлять отзыв на Яндекс, Google или 2ГИС.',
    bad_mark: '1–3★',
    bad_text: 'Недовольный — пишет вам лично в Telegram. За три секунды, пока он ещё за столиком. В интернет жалоба не попадает.',
    how_kicker: 'Как это работает',
    steps: [
      'Гость прикладывает телефон к табличке',
      'Открывается страница вашего заведения — без приложений',
      'Wi-Fi, меню, заявки и отзывы — всё в одном месте',
    ],
    who_kicker: 'Для кого',
    audience: 'Отели · Кафе · Барбершопы · Клиники · Автосервисы',
    contact_h2: 'Покажем на вашем заведении за 10 минут',
    footer: 'halo · Ташкент · gethalo.uz',
  },
  uz: {
    title: 'halo — biznes uchun aqlli NFC-teglar | Oʻzbekiston',
    h1: <>Bir teginish — va&nbsp;mehmoningiz hammasini oladi</>,
    sub: 'Muassasalar uchun aqlli NFC-teg: Wi-Fi, menyu, sharhlar, taksi, xona xizmati. Mehmon telefonini tekizadi — hammasi bir soniyada ochiladi, ilovasiz.',
    demo: 'Demoni ochish',
    write_tg: 'Telegramga yozish',
    tag_caption: 'Telefonni tekizing',
    tag_aria: 'halo teg nimani ochishini koʻrsatish',
    fan: ['Wi-Fi', 'Menyu', 'Sharhlar', 'Xizmat', 'Taksi', 'Statistika'],
    caps_kicker: 'Bir teginishda nima ochiladi',
    caps: [
      ['Wi-Fi', 'Mehmon oʻzi ulanadi — xodim parolni aytmaydi'],
      ['Menyu va narxlar', 'Doim dolzarb, chop etish va qayta yopishtirishsiz'],
      ['Filtrli sharhlar', 'Yaxshisi — xaritalarga, yomoni — shaxsan sizga'],
      ['Xona xizmati', 'Tozalash, sochiq, nonushta — ikki teginishda'],
      ['Taksi chaqirish', 'Ariza resepshnga darhol yetadi'],
      ['Qabulga yozilish', 'Salon, klinika va avtoservislar uchun'],
      ['Statistika', 'Skanlar, baholar va arizalar — raqamlarda'],
    ],
    trump_kicker: 'Bizning ustunligimiz',
    trump_h2: <>Yomon sharh internetga&nbsp;tushmasligi kerak</>,
    try_hint: 'Sinab koʻring: baho qoʻying',
    try_good: '→ Yandex · Google · 2GIS',
    try_bad: '→ sizga Telegramga, internetga emas',
    star_aria: (n) => `Baho: 5 dan ${n}`,
    good_mark: '4–5★',
    good_text: 'Mamnun mehmon bir teginishda Yandex, Google yoki 2GIS-ga sharh qoldirgani oʻtadi.',
    bad_mark: '1–3★',
    bad_text: 'Norozi mehmon esa sizga shaxsan Telegramga yozadi. Uch soniyada, hali stolda oʻtirganida. Shikoyat internetga chiqmaydi.',
    how_kicker: 'Bu qanday ishlaydi',
    steps: [
      'Mehmon telefonini tegga tekizadi',
      'Muassasangiz sahifasi ochiladi — ilovasiz',
      'Wi-Fi, menyu, arizalar va sharhlar — hammasi bir joyda',
    ],
    who_kicker: 'Kim uchun',
    audience: 'Mehmonxonalar · Kafelar · Barbershoplar · Klinikalar · Avtoservislar',
    contact_h2: 'Muassasangizda 10 daqiqada koʻrsatamiz',
    footer: 'halo · Toshkent · gethalo.uz',
  },
}

const FAN_ICONS = [Wifi, BookOpen, Star, BellRing, Car, BarChart3]
const CAP_ICONS = [Wifi, BookOpen, Star, BellRing, Car, Calendar, BarChart3]

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const NO_HOVER = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

/* ─── Сигнатура: физический тег ─── */
function HeroTag({ c }) {
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

  // тумблер: тап — разлетелись и крутятся, повторный тап — убрались
  function toggle(auto = false) {
    if (!auto) touched.current = true
    clearTimers()
    setOpen((was) => {
      if (was) return false
      setBurst((b) => b + 1)
      return true
    })
  }

  // автозапуск: один раз через 3 секунды, если не тапнули
  useEffect(() => {
    if (REDUCED()) {
      setOpen(true) // статика: показываем разложенные карточки
      return
    }
    const t = setTimeout(() => {
      if (!touched.current) toggle(true)
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
          {c.fan.map((label, i) => {
            const Icon = FAN_ICONS[i]
            return (
              <li
                key={i}
                style={{ '--a': `${i * 60}deg`, transitionDelay: open ? `${140 + i * 55}ms` : `${(5 - i) * 45}ms` }}
              >
                <span className="lp-pill">
                  <Icon size={17} strokeWidth={1.9} />
                  {label}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* сама табличка (обёртка — лёгкое парение) */}
      <div className="lp-tag-float">
        <button
          type="button"
          className="lp-tag"
          ref={tagRef}
          onClick={() => toggle(false)}
          aria-label={c.tag_aria}
        >
          <span className="lp-tag-gloss" aria-hidden="true" />
          <HaloIcon className="lp-tag-arcs" size={126} strokeWidth={7} />
          <span className="lp-tag-caption">{c.tag_caption}</span>
        </button>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { lang } = useLang()
  const c = L[lang]
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
    document.title = c.title
    document.documentElement.lang = lang
  }, [lang, c.title])

  useEffect(() => {
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
      <LangSwitch className="lp-lang" />

      {/* ─── HERO ─── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <HaloLogo className="lp-logo" size={30} />
            <h1 className="lp-display">{c.h1}</h1>
            <p className="lp-hero-sub">{c.sub}</p>
            <div className="lp-cta">
              <a className="lp-btn lp-btn-solid" href={`${base}v/demo`}>
                {c.demo}
              </a>
              <a className="lp-btn lp-btn-ghost" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
                {c.write_tg}
              </a>
            </div>
          </div>
          <HeroTag c={c} />
        </div>
      </section>

      {/* ─── ВОЗМОЖНОСТИ ─── */}
      <section className="lp-section">
        <div className="lp-kicker">{c.caps_kicker}</div>
        <ul className="lp-caps">
          {c.caps.map(([title, text], i) => {
            const Icon = CAP_ICONS[i]
            return (
              <li key={title} className="lp-reveal" style={{ transitionDelay: `${i * 45}ms` }}>
                <Icon size={20} strokeWidth={1.8} className="lp-cap-icon" />
                <span className="lp-cap-title">{title}</span>
                <span className="lp-cap-text">{text}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ─── КОЗЫРЬ: ФИЛЬТР ОТЗЫВОВ ─── */}
      <section className="lp-section lp-trump">
        <div className="lp-kicker">{c.trump_kicker}</div>
        <h2 className="lp-display lp-reveal">{c.trump_h2}</h2>

        <div className="lp-trump-try lp-reveal">
          <div className="lp-trump-stars" role="group" aria-label={c.try_hint}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`lp-tstar ${tStars >= n ? 'on' : ''}`}
                onClick={() => setTStars(n)}
                aria-label={c.star_aria(n)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />
                </svg>
              </button>
            ))}
          </div>
          <div className="lp-trump-caption" aria-live="polite">
            {tStars === 0 && c.try_hint}
            {tStars >= 4 && c.try_good}
            {tStars >= 1 && tStars <= 3 && c.try_bad}
          </div>
        </div>

        <div className="lp-trump-cols">
          <div className="lp-reveal">
            <div className={`lp-trump-col ${tStars >= 1 && tStars <= 3 ? 'dim' : ''}`}>
              <div className="lp-trump-mark lp-trump-good">{c.good_mark}</div>
              <p>{c.good_text}</p>
            </div>
          </div>
          <div className="lp-reveal" style={{ transitionDelay: '60ms' }}>
            <div className={`lp-trump-col ${tStars >= 4 ? 'dim' : ''}`}>
              <div className="lp-trump-mark">{c.bad_mark}</div>
              <p>{c.bad_text}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── КАК РАБОТАЕТ ─── */}
      <section className="lp-section">
        <div className="lp-kicker">{c.how_kicker}</div>
        <ol className="lp-steps">
          {c.steps.map((s, i) => (
            <li key={i} className="lp-reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── ДЛЯ КОГО ─── */}
      <section className="lp-section">
        <div className="lp-kicker">{c.who_kicker}</div>
        <p className="lp-display lp-audience lp-reveal">{c.audience}</p>
      </section>

      {/* ─── КОНТАКТ ─── */}
      <section className="lp-section lp-contact">
        <HaloIcon className="lp-contact-arcs" size={56} />
        <h2 className="lp-display">{c.contact_h2}</h2>
        <div className="lp-cta">
          <a className="lp-btn lp-btn-solid" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            <Send size={18} strokeWidth={2} /> {c.write_tg}
          </a>
          <a className="lp-btn lp-btn-ghost" href={`tel:${PHONE.replace(/[^+\d]/g, '')}`}>
            <Phone size={18} strokeWidth={2} /> {PHONE}
          </a>
          <a className="lp-btn lp-btn-ghost" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
            <InstagramIcon size={20} /> Instagram
          </a>
        </div>
      </section>

      <footer className="lp-footer">{c.footer}</footer>
    </div>
  )
}
