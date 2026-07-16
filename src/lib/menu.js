// Выбор поля по языку (title_ru/title_uz/title_en/title_tr), фолбэк на русский.
export function pick(row, field, lang) {
  if (!row) return ''
  return row[`${field}_${lang}`] || row[`${field}_ru`] || ''
}

export const MENU_UI = {
  ru: { all: 'Все', new: 'Новинки', search: 'Поиск блюда', empty: 'Пока ничего нет в этом разделе', menu: 'Меню' },
  uz: { all: 'Hammasi', new: 'Yangi', search: 'Taom qidirish', empty: "Bu bo'limda hozircha hech narsa yo'q", menu: 'Menyu' },
  en: { all: 'All', new: 'New', search: 'Search a dish', empty: 'Nothing here yet', menu: 'Menu' },
  tr: { all: 'Hepsi', new: 'Yeni', search: 'Yemek ara', empty: 'Burada henüz bir şey yok', menu: 'Menü' },
}

// Все языки, которые заведение может включить для меню.
export const MENU_LANGS = ['ru', 'uz', 'en', 'tr']
export const LANG_NAMES = { ru: 'Русский', uz: "O'zbekcha", en: 'English', tr: 'Türkçe' }

// Языки меню конкретного заведения (venues.menu_languages), с дефолтом ru/uz/en.
export function venueLangs(venue) {
  const list = Array.isArray(venue?.menu_languages) ? venue.menu_languages.filter((l) => MENU_LANGS.includes(l)) : []
  return list.length ? list : ['ru', 'uz', 'en']
}
