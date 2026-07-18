// Формирование платёжных ссылок. По одной функции на провайдера — новый
// банк добавляется здесь, без изменения UI.
//
// Форматы сверены с документацией провайдеров:
//   Payme  — checkout.paycom.uz/<base64(m=..;ac.order_id=..;a=..)>, сумма в тийинах
//            https://developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/
//   Click  — my.click.uz/services/pay?service_id&merchant_id&amount&transaction_param&return_url
//            https://docs.click.uz/en/click-button/  (сумма в сумах, нужны service_id И merchant_id)
//   Uzum   — оплата создаётся через server-to-server API (developer.uzumbank.uz), статической
//            merchant-id ссылки нет. Поэтому Uzum, как и «custom», принимает готовую ссылку
//            от банка с плейсхолдерами {amount}/{order_id}.

const b64 = (s) =>
  typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64')

// account: для payme — merchant_id; для click — "service_id:merchant_id";
//          для uzum/custom — полная ссылка-шаблон.
export function buildPaymentUrl(provider, account, { amount, orderId, returnUrl } = {}) {
  const sum = Math.max(0, Math.round(Number(amount) || 0))
  const oid = orderId != null ? String(orderId) : ''
  switch (provider) {
    case 'payme':
      return buildPayme(account, sum, oid, returnUrl)
    case 'click':
      return buildClick(account, sum, oid, returnUrl)
    case 'uzum':
    case 'custom':
      return buildFromTemplate(account, sum, oid)
    default:
      return null
  }
}

function buildPayme(merchantId, sum, orderId, returnUrl) {
  if (!merchantId) return null
  const parts = [`m=${merchantId}`, `ac.order_id=${orderId}`, `a=${sum * 100}`] // тийины
  if (returnUrl) parts.push(`c=${returnUrl}`)
  return `https://checkout.paycom.uz/${b64(parts.join(';'))}`
}

function buildClick(account, sum, orderId, returnUrl) {
  const [serviceId, merchantId] = String(account || '').split(':')
  if (!serviceId || !merchantId) return null
  const p = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(sum),
    transaction_param: orderId,
  })
  if (returnUrl) p.set('return_url', returnUrl)
  return `https://my.click.uz/services/pay?${p.toString()}`
}

function buildFromTemplate(url, sum, orderId) {
  if (!url) return null
  return String(url)
    .replace(/\{amount\}/g, String(sum))
    .replace(/\{order_id\}/g, orderId)
}

// ── провайдеры для мастера подключения ──
export const PAYMENT_PROVIDERS = [
  { key: 'payme', name: 'Payme', color: '#33b0b9', kind: 'merchant' },
  { key: 'click', name: 'Click', color: '#00a3ff', kind: 'click' },
  { key: 'uzum', name: 'Uzum', color: '#7b3ff2', kind: 'url' },
  { key: 'custom', name: 'Другой банк', color: '#6b7280', kind: 'url' },
]

export const providerMeta = (key) => PAYMENT_PROVIDERS.find((p) => p.key === key)

// ── инструкции «Где взять?» (место под скриншоты — [SCREENSHOT]) ──
export const PAYMENT_HELP = {
  payme: [
    'Войдите в кабинет мерчанта: business.payme.uz.',
    'Откройте раздел «Кассы» и выберите вашу кассу (или создайте новую для заведения).',
    'Скопируйте «ID кассы» — это 24 символа из цифр и латинских букв (a–f).',
    '[SCREENSHOT: где в кабинете Payme находится ID кассы]',
  ],
  click: [
    'Войдите в кабинет мерчанта Click: merchant.click.uz.',
    'В настройках сервиса найдите «Service ID» и «Merchant ID» — это числа.',
    'Впишите оба значения в поля ниже.',
    '[SCREENSHOT: где в кабинете Click находятся Service ID и Merchant ID]',
  ],
  uzum: [
    'Uzum формирует платёжную ссылку в кабинете мерчанта (или её выдаёт ваш менеджер Uzum).',
    'Скопируйте эту ссылку целиком и вставьте ниже.',
    'Если в ссылке есть место для суммы и номера заказа — впишите там {amount} и {order_id}, halo подставит их автоматически.',
    '[SCREENSHOT: где в кабинете Uzum взять платёжную ссылку]',
  ],
  custom: [
    'Вставьте готовую платёжную ссылку вашего банка/агрегатора.',
    'Чтобы сумма и номер заказа подставлялись автоматически, впишите в ссылке {amount} (сумма в сумах) и {order_id}.',
    'Пример: https://pay.mybank.uz/checkout?sum={amount}&ref={order_id}',
  ],
}

// ── валидация ввода (человеческим языком) ──
export function validatePayme(id) {
  const v = (id || '').trim()
  if (!v) return 'Введите ID кассы Payme.'
  if (!/^[a-f0-9]{24}$/i.test(v)) return 'ID кассы Payme — это 24 символа из цифр и латинских букв a–f. Похоже, скопировано не полностью.'
  return null
}
export function validateClick(serviceId, merchantId) {
  if (!String(serviceId || '').trim() || !String(merchantId || '').trim()) return 'Заполните и Service ID, и Merchant ID.'
  if (!/^\d+$/.test(String(serviceId).trim()) || !/^\d+$/.test(String(merchantId).trim()))
    return 'Service ID и Merchant ID — это числа. Уберите лишние символы.'
  return null
}
export function validateUrl(url) {
  const v = (url || '').trim()
  if (!v) return 'Вставьте платёжную ссылку.'
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return 'Ссылка должна начинаться с https://'
  } catch {
    return 'Это не похоже на ссылку. Скопируйте её целиком, вместе с https://'
  }
  return null
}
