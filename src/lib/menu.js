// Выбор поля по языку (title_ru/title_uz/title_en), фолбэк на русский.
export function pick(row, field, lang) {
  if (!row) return ''
  return row[`${field}_${lang}`] || row[`${field}_ru`] || ''
}

export const MENU_UI = {
  ru: { all: 'Все', new: 'Новинки', search: 'Поиск блюда', empty: 'Пока ничего нет в этом разделе', menu: 'Меню' },
  uz: { all: 'Hammasi', new: 'Yangi', search: 'Taom qidirish', empty: "Bu bo'limda hozircha hech narsa yo'q", menu: 'Menyu' },
  en: { all: 'All', new: 'New', search: 'Search a dish', empty: 'Nothing here yet', menu: 'Menu' },
}
