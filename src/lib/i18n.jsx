import React, { createContext, useContext, useState } from 'react'

// Язык гостевых страниц (лендинг + страницы заведений).
// Админка всегда на русском, Telegram-уведомления владельцу — тоже.
// Приоритет: ?lang=… → localStorage → английский по умолчанию.

export const DICT = {
  en: {
    notfound_title: 'Venue not found',
    notfound_sub: 'Check the link or scan the QR code again.',
    thanks: 'Thank you!',
    owner_got: 'The owner has already received your message.',
    share_rating: 'Thank you! Share your rating:',
    feedback_ph: 'Tell us what went wrong — we will fix it',
    contact_ph: 'Phone or name (optional)',
    send: 'Send',
    sending: 'Sending…',
    network: 'Network',
    password: 'Password',
    copy_pass: 'Copy password',
    copied: '✓ Copied',
    your_name: 'Your name',
    phone_ph: 'Phone',
    service_ph: 'Service (optional)',
    appt_time_ph: 'Preferred time, e.g. tomorrow after 3 pm',
    book: 'Book',
    request_sent: 'Request sent!',
    will_contact: 'We will contact you to confirm.',
    room_number: 'Room number',
    room: 'Room',
    room_hint: 'Enter your room number to send a request',
    request_accepted: 'Request accepted!',
    coming: 'We will be right up.',
    order_more: 'Order more',
    order: 'Order',
    back_list: '← Back to the list',
    empty_services: 'No services yet',
    free: 'Free',
    broken_ph: 'Describe what happened (required)',
    comment_ph: 'Comment (optional)',
    svc_time_ph: 'Preferred time (optional)',
    where_to: 'Where to',
    now: 'Now',
    later: 'At a time',
    call_taxi: 'Call a taxi',
    reception: 'Reception will contact you.',
    address: 'Address',
    phone_label: 'Phone',
    powered: 'Powered by',
    my_bill: 'My bill',
  },
  ru: {
    notfound_title: 'Заведение не найдено',
    notfound_sub: 'Проверьте ссылку или отсканируйте QR-код ещё раз.',
    thanks: 'Спасибо!',
    owner_got: 'Владелец уже получил ваше сообщение.',
    share_rating: 'Спасибо! Поделитесь оценкой:',
    feedback_ph: 'Расскажите, что было не так — мы исправим',
    contact_ph: 'Телефон или имя (по желанию)',
    send: 'Отправить',
    sending: 'Отправляем…',
    network: 'Сеть',
    password: 'Пароль',
    copy_pass: 'Скопировать пароль',
    copied: '✓ Скопировано',
    your_name: 'Ваше имя',
    phone_ph: 'Телефон',
    service_ph: 'Услуга (по желанию)',
    appt_time_ph: 'Удобное время, например: завтра после 15:00',
    book: 'Записаться',
    request_sent: 'Заявка отправлена!',
    will_contact: 'С вами свяжутся для подтверждения.',
    room_number: 'Номер комнаты',
    room: 'Номер',
    room_hint: 'Укажите номер комнаты, чтобы отправить запрос',
    request_accepted: 'Заявка принята!',
    coming: 'Скоро подойдём.',
    order_more: 'Заказать ещё',
    order: 'Заказать',
    back_list: '← К списку',
    empty_services: 'Список услуг пока пуст',
    free: 'Бесплатно',
    broken_ph: 'Опишите, что случилось (обязательно)',
    comment_ph: 'Комментарий (по желанию)',
    svc_time_ph: 'К какому времени (по желанию)',
    where_to: 'Куда ехать',
    now: 'Сейчас',
    later: 'Ко времени',
    call_taxi: 'Вызвать такси',
    reception: 'Ресепшн свяжется с вами.',
    address: 'Адрес',
    phone_label: 'Телефон',
    powered: 'Работает на',
    my_bill: 'Мой счёт',
  },
  uz: {
    notfound_title: 'Muassasa topilmadi',
    notfound_sub: 'Havolani tekshiring yoki QR-kodni qayta skanerlang.',
    thanks: 'Rahmat!',
    owner_got: 'Egasi xabaringizni oldi.',
    share_rating: 'Rahmat! Bahoyingizni qoldiring:',
    feedback_ph: 'Nima yoqmadi — ayting, tuzatamiz',
    contact_ph: 'Telefon yoki ism (ixtiyoriy)',
    send: 'Yuborish',
    sending: 'Yuborilmoqda…',
    network: 'Tarmoq',
    password: 'Parol',
    copy_pass: 'Parolni nusxalash',
    copied: '✓ Nusxalandi',
    your_name: 'Ismingiz',
    phone_ph: 'Telefon',
    service_ph: 'Xizmat (ixtiyoriy)',
    appt_time_ph: 'Qulay vaqt, masalan: ertaga 15:00 dan keyin',
    book: 'Yozilish',
    request_sent: 'Ariza yuborildi!',
    will_contact: "Tasdiqlash uchun siz bilan bog'lanishadi.",
    room_number: 'Xona raqami',
    room: 'Xona',
    room_hint: "So'rov yuborish uchun xona raqamini kiriting",
    request_accepted: 'Ariza qabul qilindi!',
    coming: 'Tez orada boramiz.',
    order_more: 'Yana buyurtma',
    order: 'Buyurtma berish',
    back_list: "← Ro'yxatga",
    empty_services: "Xizmatlar ro'yxati hozircha bo'sh",
    free: 'Bepul',
    broken_ph: "Nima bo'lganini yozing (majburiy)",
    comment_ph: 'Izoh (ixtiyoriy)',
    svc_time_ph: 'Qaysi vaqtga (ixtiyoriy)',
    where_to: 'Qayerga',
    now: 'Hozir',
    later: 'Vaqtga',
    call_taxi: 'Taksi chaqirish',
    reception: "Resepshn siz bilan bog'lanadi.",
    address: 'Manzil',
    phone_label: 'Telefon',
    powered: 'Platforma:',
    my_bill: 'Mening hisobim',
  },
}

const LANGS = ['en', 'ru', 'uz']

export function getInitialLang() {
  if (typeof window === 'undefined') return 'en'
  const p = new URLSearchParams(window.location.search).get('lang')
  if (LANGS.includes(p)) return p
  const saved = localStorage.getItem('halo-lang')
  if (LANGS.includes(saved)) return saved
  return 'en'
}

const LangCtx = createContext({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang)
  function setLang(l) {
    try {
      localStorage.setItem('halo-lang', l)
    } catch {
      /* приватный режим */
    }
    setLangState(l)
  }
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

export function useLang() {
  return useContext(LangCtx)
}

export function useT() {
  const { lang } = useLang()
  return (key) => DICT[lang]?.[key] ?? DICT.ru[key] ?? key
}

export function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={lang === l ? 'on' : ''}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
