import React, { useEffect } from 'react'
import {
  AlertTriangle,
  VolumeX,
  Eye,
  Wifi,
  BookOpen,
  BellRing,
  Car,
  Calendar,
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

const PROBLEMS = [
  { Icon: AlertTriangle, text: 'Один злой отзыв в Яндексе отпугивает десятки клиентов' },
  { Icon: VolumeX, text: 'Довольные гости молчат — они не помнят про отзыв' },
  { Icon: Eye, text: 'О проблеме вы узнаёте, когда её уже прочитали все' },
]

const STEPS = [
  'Гость прикладывает телефон к табличке',
  'Открывается страница вашего заведения',
  'Оценка 4–5 звёзд → гость идёт на Яндекс / Google / 2ГИС',
  'Оценка 1–3 → жалоба приходит вам в Telegram, а не в интернет',
]

const FEATURES = [
  { Icon: Wifi, text: 'Wi-Fi без вопросов персоналу' },
  { Icon: BookOpen, text: 'Меню и прайс' },
  { Icon: BellRing, text: 'Обслуживание номера' },
  { Icon: Car, text: 'Вызов такси' },
  { Icon: Calendar, text: 'Запись на приём' },
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
    document.title = 'halo — умная NFC-табличка для заведений'
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
          <h1>Защитите репутацию вашего заведения</h1>
          <p className="landing-sub">
            Умная NFC-табличка: довольные гости идут оставлять отзывы на карты, недовольные —
            пишут напрямую вам, а не в интернет
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

        {/* ─── ПРОБЛЕМА ─── */}
        <section className="landing-section">
          <h2>Почему это важно</h2>
          <div className="landing-cards">
            {PROBLEMS.map(({ Icon, text }) => (
              <div className="card landing-card" key={text}>
                <Icon size={26} strokeWidth={1.8} className="landing-card-icon" />
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

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
          <h2>Что ещё умеет</h2>
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
