// Takeaway: статусы, переходы, расчёт времени. Единый источник правды
// для экрана гостя, экрана баристы, симулятора и бэкенда.
// Модуль инертен, пока VITE_FEATURE_TAKEAWAY !== 'true'.

/** @typedef {'created'|'paid'|'accepted'|'preparing'|'ready'|'picked_up'|'cancelled'} TakeawayStatus */

// Фича-флаг: выключен — ни один takeaway-роут не регистрируется.
export const FEATURE_TAKEAWAY =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_FEATURE_TAKEAWAY === 'true'

// Мок-оплата: вместо редиректа на банк — локальная /dev/pay/:orderId.
export const PAYMENTS_MOCK =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_PAYMENTS_MOCK === 'true'

// created → paid → accepted → preparing → ready → picked_up; cancelled — из любого.
export const TAKEAWAY_STATUSES = ['created', 'paid', 'accepted', 'preparing', 'ready', 'picked_up']

/** Следующий статус по кнопке «вперёд» (у баристы). */
export const NEXT_STATUS = {
  created: 'paid', // «гость сообщил, что оплатил» — подтверждается вручную
  paid: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'picked_up',
}

export const STATUS_LABELS = {
  created: 'Ожидает оплаты',
  paid: 'Оплачен (со слов гостя)',
  accepted: 'Принят',
  preparing: 'Готовится',
  ready: 'Готов — заберите',
  picked_up: 'Выдан',
  cancelled: 'Отменён',
}

export function isFinalStatus(s) {
  return s === 'picked_up' || s === 'cancelled'
}

export function canCancel(s) {
  return !!s && !isFinalStatus(s)
}

// Ожидаемое время «X–Y минут»: X = max(prep_minutes) + queue_load, Y = X + 5.
// Точное число не показываем никогда.
export function etaRange(items, queueLoad = 0) {
  const prep = Math.max(0, ...items.map((i) => Number(i.prep_minutes) || 0))
  const from = prep + (Number(queueLoad) || 0)
  return { from, to: from + 5 }
}

export function etaLabel(items, queueLoad = 0) {
  const { from, to } = etaRange(items, queueLoad)
  return `${from}–${to} минут`
}

// Код выдачи: 4 цифры (уникальность в пределах дня/заведения — индекс в БД,
// при коллизии вставка повторяется с новым кодом).
export function genPickupCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}
