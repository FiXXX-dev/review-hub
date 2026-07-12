// Реестр типов блоков. Подписи/иконки по умолчанию — фолбэк на случай,
// когда блок включён вручную и его нет в пресете заведения.
export const BLOCK_DEFS = {
  rating: { label_ru: 'Оценить нас', label_uz: 'Bizni baholang', icon: '⭐' },
  menu: { label_ru: 'Меню', label_uz: 'Menyu', icon: '📖' },
  wifi: { label_ru: 'Wi-Fi', label_uz: 'Wi-Fi', icon: '📶' },
  instagram: { label_ru: 'Instagram', label_uz: 'Instagram', icon: '📷' },
  telegram: { label_ru: 'Telegram', label_uz: 'Telegram', icon: '✈️' },
  contacts: { label_ru: 'Контакты', label_uz: 'Kontaktlar', icon: '📍' },
  price: { label_ru: 'Прайс', label_uz: 'Narxlar', icon: '💰' },
  doctors: { label_ru: 'Наши врачи', label_uz: 'Shifokorlarimiz', icon: '🩺' },
  appointment: { label_ru: 'Записаться', label_uz: 'Yozilish', icon: '📅' },
  services: { label_ru: 'Услуги', label_uz: 'Xizmatlar', icon: '🛎️' },
  taxi: { label_ru: 'Вызвать такси', label_uz: 'Taksi chaqirish', icon: '🚕' },
  catalog: { label_ru: 'Каталог', label_uz: 'Katalog', icon: '🛍️' },
  masters: { label_ru: 'Наши мастера', label_uz: 'Ustalarimiz', icon: '💇' },
  phone: { label_ru: 'Позвонить', label_uz: "Qo'ng'iroq qilish", icon: '📞' },
}

// Блоки-ссылки: иконка + подпись + url (url лежит в venues.block_links)
export const LINK_TYPES = ['menu', 'price', 'catalog', 'doctors', 'masters', 'services', 'taxi']

// Поведение до пресетов: если у заведения нет ни пресета, ни enabled_blocks
export const LEGACY_BLOCKS = ['rating', 'menu', 'wifi', 'instagram', 'telegram']

export function blockUrl(venue, type) {
  const links = venue.block_links || {}
  if (links[type]) return links[type]
  if (type === 'menu') return venue.menu_url // старое поле, до block_links
  return null
}

// Итоговый упорядоченный список блоков: {type, label, icon}
// enabled_blocks задаёт порядок и состав; пресет даёт подписи/иконки; rating всегда первый.
export function resolveBlocks(venue) {
  const presetBlocks = venue.preset?.blocks ?? []
  const defs = { ...BLOCK_DEFS }
  for (const b of presetBlocks) {
    if (b?.type) defs[b.type] = { ...BLOCK_DEFS[b.type], ...b }
  }

  let types
  if (venue.enabled_blocks?.length) {
    types = venue.enabled_blocks
  } else if (presetBlocks.length) {
    types = presetBlocks.map((b) => b.type)
  } else {
    types = LEGACY_BLOCKS
  }

  const ordered = types.includes('rating')
    ? ['rating', ...types.filter((t) => t !== 'rating')]
    : [...types]

  return ordered
    .filter((t, i) => defs[t] && ordered.indexOf(t) === i)
    .map((t) => ({ type: t, label: defs[t].label_ru, icon: defs[t].icon }))
}
