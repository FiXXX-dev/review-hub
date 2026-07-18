import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BellRing, RefreshCw, CreditCard } from 'lucide-react'
import { formatPrice } from './lib/blocks.js'
import { buildPaymentUrl } from './lib/paymentLinks.js'

// Гостевой счёт (read-only): тот же заказ, что вбил официант.
// Гость видит сумму заранее, но заказывает через официанта.
export default function BillPage({ slug }) {
  const table = new URLSearchParams(window.location.search).get('table') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [called, setCalled] = useState(false)
  const [awaiting, setAwaiting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/order?slug=${encodeURIComponent(slug)}&table=${encodeURIComponent(table)}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'error')
      setData(j)
      if (j.venue?.accent_color) document.documentElement.style.setProperty('--accent', j.venue.accent_color)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [slug, table])

  useEffect(() => {
    load()
  }, [load])

  function payOnline() {
    const v = data?.venue
    const order = data?.order
    if (!v?.payment_enabled || !order) return
    const account =
      v.payment_provider === 'payme' || v.payment_provider === 'click'
        ? v.payment_merchant_id
        : v.payment_custom_url
    const link = buildPaymentUrl(v.payment_provider, account, {
      amount: order.total,
      orderId: order.id,
      returnUrl: window.location.href,
    })
    if (!link) return
    // ставим статус ожидания (подтверждение оплаты — ручное, официантом)
    fetch('/api/pay-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, table }),
    }).catch(() => {})
    setAwaiting(true)
    window.open(link, '_blank', 'noopener')
  }

  async function callWaiter() {
    if (!data?.venue?.id || called) return
    try {
      await fetch('/api/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: data.venue.id, table_no: table }),
      })
      setCalled(true)
      setTimeout(() => setCalled(false), 6000)
    } catch {
      /* тихо */
    }
  }

  if (loading) return <div className="page center"><div className="spinner" /></div>
  if (error || !table) {
    return (
      <div className="page center">
        <div className="notfound">
          <div className="notfound-emoji">🧾</div>
          <h1>Счёт недоступен</h1>
          <p>{!table ? 'Отсканируйте QR-код на вашем столе.' : 'Попробуйте позже.'}</p>
        </div>
      </div>
    )
  }

  const order = data.order
  const money = (n) => formatPrice(n, 'ru')

  return (
    <div className="bill-page">
      <header className="bill-head">
        <a className="bill-back" href={`${import.meta.env.BASE_URL}v/${slug}?table=${encodeURIComponent(table)}`} aria-label="Назад">
          <ArrowLeft size={20} />
        </a>
        <span className="bill-title">{data.venue?.name} · Стол {table}</span>
        <button className="bill-refresh" onClick={load} aria-label="Обновить"><RefreshCw size={18} /></button>
      </header>

      <div className="bill-body">
        {!order || !order.items.length ? (
          <p className="bill-empty">Заказ ещё не открыт. Позовите официанта, чтобы сделать заказ.</p>
        ) : (
          <div className="bill-card">
            <div className="bill-list">
              {order.items.map((it, i) => (
                <div key={i} className="bill-row">
                  <span className="bill-row-name">{it.qty}× {it.title_snapshot}</span>
                  <span className="bill-row-sum">{money(Number(it.price_snapshot) * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="bill-total">
              <span>Итого</span>
              <span>{money(order.total)}</span>
            </div>

            {(() => {
              const v = data.venue || {}
              const paid = order.payment_status === 'paid'
              const isAwaiting = awaiting || order.payment_status === 'awaiting'
              if (paid) return <p className="bill-pay-line paid">✓ Оплата подтверждена</p>
              if (v.payment_enabled && isAwaiting)
                return (
                  <div className="bill-await">
                    <p>Ожидаем подтверждение оплаты.</p>
                    <p className="bill-note">Покажите этот экран официанту — он подтвердит поступление.</p>
                  </div>
                )
              if (v.payment_enabled)
                return (
                  <button className="btn btn-primary bill-pay" onClick={payOnline}>
                    <CreditCard size={18} /> Оплатить онлайн
                  </button>
                )
              return <p className="bill-note">Заказ принимает официант. Оплата — на месте.</p>
            })()}
          </div>
        )}

        <button className="btn btn-secondary bill-call" onClick={callWaiter} disabled={called}>
          <BellRing size={18} /> {called ? 'Официант уже идёт' : 'Позвать официанта'}
        </button>
      </div>
    </div>
  )
}
