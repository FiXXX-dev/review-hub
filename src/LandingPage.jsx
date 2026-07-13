import React, { useEffect } from 'react'
import {
  Star,
  Wifi,
  BookOpen,
  BellRing,
  Car,
  BarChart3,
  Hotel,
  Coffee,
  Scissors,
  Stethoscope,
  Wrench,
  Send,
  Phone,
  Camera,
} from 'lucide-react'

// ─── Контакты halo: поменяй на свои ───
const TELEGRAM_URL = 'https://t.me/bangbangrs'
const PHONE = '+998 95 183-66-36'
const INSTAGRAM_URL = '' // Instagram halo (пусто = кнопка скрыта)

const STEPS = [
  'Гость прикладывает телефон к табличке',
  'Открывается страница вашего заведения — без приложений и QR-сканеров',
  'Гость сам подключается к Wi-Fi, заказывает услуги, вызывает такси или оставляет отзыв',
]

const FEATURES = [
  { Icon: Wifi, text: 'Wi-Fi без вопросов персоналу' },
  { Icon: BellRing, text: 'Обслуживание номера' },
  { Icon: Car, text: 'Вызов такси' },
  { Icon: BookOpen, text: 'Меню и прайс' },
  { Icon: Star, text: 'Отзывы на карты в один тап' },
  { Icon: BarChart3, text: 'Статистика сканов' },
]

const AUDIENCE = [
  { Icon: Hotel, text: 'Отели' },
  { Icon: Coffee, text: 'Кафе и рестораны' },
  { Icon: Scissors, text: 'Барбершопы и салоны' },
  { Icon: Stethoscope, text: 'Клиники' },
  { Icon: Wrench, text: 'Автосервисы' },
]

export default function LandingPage() {
  useEffect(() => {
    document.title = 'halo — универсальные NFC-таблички'
    document.documentElement.style.setProperty('--accent', '#1B62F0')
  }, [])

  const base = import.meta.env.BASE_URL

  return (
    <div className="page landing">
      <div className="container landing-container">
        {/* ─── HERO ─── */}
        <header className="landing-hero">
          <div className="landing-logo">
            <img src={`${base}halo.svg`} alt="" />
            <span>halo</span>
          </div>
          <h1>Универсальные NFC-таблички для вашего заведения</h1>
          <p className="landing-sub">
            Гость прикладывает телефон — и видит страницу вашего заведения: Wi-Fi, меню,
            обслуживание, такси. Одна табличка вместо стопки бумажек на стойке
          </p>
          <div className="landing-cta">
            <a className="btn btn-primary btn-big" href={`${base}v/demo`}>
              Посмотреть демо
            </a>
            <a className="btn btn-secondary" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
              Связаться
            </a>
          </div>
        </header>

        {/* ─── КАК РАБОТАЕТ ─── */}
        <section className="landing-section">
          <h2>Как работает</h2>
          <ol className="landing-steps">
            {STEPS.map((s, i) => (
              <li key={i}>
                <span className="landing-step-num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── ЧТО ЕЩЁ УМЕЕТ ─── */}
        <section className="landing-section">
          <h2>Что умеет табличка</h2>
          <div className="landing-grid">
            {FEATURES.map(({ Icon, text }) => (
              <div className="landing-grid-item" key={text}>
                <Icon size={22} strokeWidth={1.8} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── ДЛЯ КОГО ─── */}
        <section className="landing-section">
          <h2>Для кого</h2>
          <div className="landing-audience">
            {AUDIENCE.map(({ Icon, text }) => (
              <span className="landing-chip" key={text}>
                <Icon size={16} strokeWidth={1.8} /> {text}
              </span>
            ))}
          </div>
        </section>

        {/* ─── КОНТАКТЫ ─── */}
        <section className="landing-section">
          <h2>Контакты</h2>
          <div className="landing-contacts">
            <a className="btn btn-primary" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
              <Send size={18} strokeWidth={2} /> Написать в Telegram
            </a>
            {PHONE && (
              <a className="btn btn-secondary" href={`tel:${PHONE.replace(/[^+\d]/g, '')}`}>
                <Phone size={18} strokeWidth={2} /> {PHONE}
              </a>
            )}
            {INSTAGRAM_URL && (
              <a className="btn btn-secondary" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                <Camera size={18} strokeWidth={2} /> Instagram
              </a>
            )}
          </div>
        </section>

        <footer className="footer landing-footer">halo · Ташкент · 2026</footer>
      </div>
    </div>
  )
}
