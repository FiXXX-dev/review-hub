// Реестр типов блоков. Подписи/иконки по умолчанию — фолбэк на случай,
// когда блок включён вручную и его нет в пресете заведения.
export const BLOCK_DEFS = {
  rating: { label_ru: 'Оценить нас', label_uz: 'Bizni baholang', label_en: 'Rate us', icon: '⭐' },
  menu: { label_ru: 'Меню', label_uz: 'Menyu', label_en: 'Menu', icon: '📖' },
  wifi: { label_ru: 'Wi-Fi', label_uz: 'Wi-Fi', label_en: 'Wi-Fi', icon: '📶' },
  instagram: { label_ru: 'Instagram', label_uz: 'Instagram', label_en: 'Instagram', icon: '📷' },
  telegram: { label_ru: 'Telegram', label_uz: 'Telegram', label_en: 'Telegram', icon: '✈️' },
  contacts: { label_ru: 'Контакты', label_uz: 'Kontaktlar', label_en: 'Contacts', icon: '📍' },
  price: { label_ru: 'Прайс', label_uz: 'Narxlar', label_en: 'Prices', icon: '💰' },
  doctors: { label_ru: 'Наши врачи', label_uz: 'Shifokorlarimiz', label_en: 'Our doctors', icon: '🩺' },
  appointment: { label_ru: 'Записаться', label_uz: 'Yozilish', label_en: 'Book a visit', icon: '📅' },
  services: { label_ru: 'Услуги', label_uz: 'Xizmatlar', label_en: 'Services', icon: '🛎️' },
  service: { label_ru: 'Обслуживание номера', label_uz: 'Xona xizmati', label_en: 'Room service', icon: '🛎️' },
  info: { label_ru: 'Информация', label_uz: "Ma'lumot", label_en: 'Information', icon: 'ℹ️' },
  taxi: { label_ru: 'Вызвать такси', label_uz: 'Taksi chaqirish', label_en: 'Call a taxi', icon: '🚕' },
  catalog: { label_ru: 'Каталог', label_uz: 'Katalog', label_en: 'Catalogue', icon: '🛍️' },
  masters: { label_ru: 'Наши мастера', label_uz: 'Ustalarimiz', label_en: 'Our specialists', icon: '💇' },
  phone: { label_ru: 'Позвонить', label_uz: "Qo'ng'iroq qilish", label_en: 'Call us', icon: '📞' },
}

// Блоки-ссылки: иконка + подпись + url (url лежит в venues.block_links).
// 'taxi' и 'services' больше не ссылки — это формы-заявки.
export const LINK_TYPES = ['menu', 'price', 'catalog', 'doctors', 'masters', 'info']

// Классы такси по умолчанию (venues.taxi_classes переопределяет)
export const DEFAULT_TAXI_CLASSES = ['Эконом', 'Комфорт', 'Минивэн']

// "45000" -> "45 000 сум" | "45 000 UZS"
export function formatPrice(p, lang = 'ru') {
  const n = Number(p)
  if (!Number.isFinite(n)) return ''
  const num = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const unit = lang === 'en' ? 'UZS' : lang === 'uz' || lang === 'tr' ? "so'm" : 'сум'
  return `${num} ${unit}`
}

// Запросы обслуживания номера (блок service). Ключ хранится в
// service_requests.request_type; venues.service_options (jsonb-массив
// ключей) ограничивает список — null = включены все.
export const SERVICE_OPTIONS = [
  { key: 'cleaning', label_ru: 'Уборка', label_en: 'Cleaning' },
  { key: 'towels', label_ru: 'Полотенца / бельё', label_en: 'Towels / linens' },
  { key: 'water', label_ru: 'Вода', label_en: 'Water' },
  { key: 'late_checkout', label_ru: 'Поздний выезд', label_en: 'Late check-out' },
  { key: 'broken', label_ru: 'Что-то сломалось', label_en: 'Something broke', comment: true },
  { key: 'taxi', label_ru: 'Вызвать такси', label_en: 'Call a taxi' },
]

// автоперевод типовых названий услуг из каталога (сид отеля);
// для нестандартных названий владелец заполняет title_en в редакторе
export const SERVICE_TITLE_EN = {
  'Уборка номера': 'Room cleaning',
  'Свежие полотенца': 'Fresh towels',
  'Питьевая вода': 'Drinking water',
  'Завтрак в номер': 'Breakfast in room',
  'Прачечная': 'Laundry',
  'Поздний выезд': 'Late check-out',
  'Что-то сломалось': 'Something broke',
  'Новая услуга': 'New service',
}

export function serviceTitle(s, lang) {
  if (lang === 'en') return s.title_en || SERVICE_TITLE_EN[s.title_ru] || s.title_ru
  return s.title_ru
}

// Поведение до пресетов: если у заведения нет ни пресета, ни enabled_blocks
export const LEGACY_BLOCKS = ['rating', 'menu', 'wifi', 'instagram', 'telegram']

export function blockUrl(venue, type) {
  const links = venue.block_links || {}
  if (links[type]) return links[type]
  if (type === 'menu') return venue.menu_url // старое поле, до block_links
  return null
}

// Итоговый упорядоченный список блоков: {type, label, icon}
// enabled_blocks задаёт состав и порядок (иначе — порядок пресета);
// rating обязателен, но его позиция управляется пресетом (у отелей
// первым идёт wifi).
export function resolveBlocks(venue, lang = 'ru') {
  const presetBlocks = venue.preset?.blocks ?? []
  const defs = { ...BLOCK_DEFS }
  for (const b of presetBlocks) {
    if (b?.type) defs[b.type] = { ...BLOCK_DEFS[b.type], ...b }
  }

  let types
  if (venue.enabled_blocks?.length) {
    types = [...venue.enabled_blocks]
  } else if (presetBlocks.length) {
    types = presetBlocks.map((b) => b.type)
  } else {
    types = [...LEGACY_BLOCKS]
  }

  if (!types.includes('rating')) types.unshift('rating')

  // 'service' и 'services' — одна фича двух поколений (плитки → каталог).
  // Если включены оба, показываем один блок на позиции первого,
  // с подписью «Обслуживание номера» (вид, который выбрал владелец).
  if (types.includes('service') && types.includes('services')) {
    const first = Math.min(types.indexOf('service'), types.indexOf('services'))
    types = types.filter((t) => t !== 'service' && t !== 'services')
    types.splice(first, 0, 'service')
  }

  return types
    .filter((t, i) => defs[t] && types.indexOf(t) === i)
    .map((t) => ({
      type: t,
      label: lang === 'en' ? defs[t].label_en || defs[t].label_ru : defs[t].label_ru,
      icon: defs[t].icon,
    }))
}

// Порядок платформ отзывов: venues.rating_platform_order (jsonb-массив
// ключей), по умолчанию яндекс → google → 2гис.
export function orderPlatforms(platforms, venue) {
  const order = Array.isArray(venue.rating_platform_order) ? venue.rating_platform_order : null
  if (!order?.length) return platforms
  return [...platforms].sort((a, b) => {
    const ia = order.indexOf(a.key)
    const ib = order.indexOf(b.key)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}
