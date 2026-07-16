import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search, Plus, Minus, Receipt, Utensils } from 'lucide-react'
import { api } from './lib/cabinetApi.js'
import { pick } from './lib/menu.js'
import { formatPrice } from './lib/blocks.js'

const money = (n) => formatPrice(n, 'ru')

export default function WaiterScreen({ token, venue }) {
  const [tables, setTables] = useState([]) // [{number}]
  const [open, setOpen] = useState([]) // открытые заказы
  const [menu, setMenu] = useState(null) // {categories, items}
  const [view, setView] = useState('tables') // 'tables' | 'order'
  const [tableNum, setTableNum] = useState(null)
  const [error, setError] = useState('')

  const loadTables = useCallback(async () => {
    const [t, o] = await Promise.all([
      api(`/venue/${venue.id}/tables`, { token }),
      api(`/venue/${venue.id}/orders/open`, { token }),
    ])
    setTables(t.tables || [])
    setOpen(o.orders || [])
  }, [token, venue.id])

  useEffect(() => {
    api(`/venue/${venue.id}/menu`, { token })
      .then((m) => setMenu({ categories: (m.categories || []).filter((c) => c.is_active), items: (m.items || []).filter((i) => i.is_active) }))
      .catch((e) => setError(e.message))
    loadTables().catch((e) => setError(e.message))
  }, [token, venue.id, loadTables])

  const openByTable = useMemo(() => {
    const m = {}
    for (const o of open) m[o.table_number] = o
    return m
  }, [open])

  // объединяем заданные столы и столы с открытыми заказами (на случай гостевых)
  const tableNums = useMemo(() => {
    const s = new Set(tables.map((t) => t.number))
    for (const o of open) s.add(o.table_number)
    return [...s].sort((a, b) => a - b)
  }, [tables, open])

  function openTable(num) {
    setTableNum(num)
    setView('order')
  }

  async function backToTables() {
    setView('tables')
    setTableNum(null)
    await loadTables().catch(() => {})
  }

  if (error && !menu) return <p className="admin-error" style={{ marginTop: 16 }}>{error}</p>
  if (!menu) return <div className="spinner" style={{ margin: '32px auto' }} />

  if (view === 'order') {
    return (
      <OrderScreen
        token={token}
        venue={venue}
        num={tableNum}
        menu={menu}
        onBack={backToTables}
      />
    )
  }

  return (
    <div className="waiter">
      {error && <p className="admin-error">{error}</p>}
      {tableNums.length === 0 ? (
        <p className="admin-empty">Столы не заданы. Добавьте их в кабинете владельца (раздел «Столы»).</p>
      ) : (
        <div className="wt-grid">
          {tableNums.map((n) => {
            const o = openByTable[n]
            return (
              <button key={n} className={`wt-tile ${o ? 'busy' : 'free'}`} onClick={() => openTable(n)}>
                <span className="wt-num">Стол {n}</span>
                <span className="wt-state">{o ? money(o.total) : 'свободен'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OrderScreen({ token, venue, num, menu, onBack }) {
  const [order, setOrder] = useState(null) // текущий открытый счёт (уже отправленное)
  const [pending, setPending] = useState({}) // { [itemId]: {menu_item_id,title,price,qty} }
  const [catId, setCatId] = useState('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showBill, setShowBill] = useState(false)

  const loadOrder = useCallback(() => {
    return api(`/venue/${venue.id}/orders/table/${num}`, { token }).then((r) => setOrder(r.order))
  }, [token, venue.id, num])

  useEffect(() => {
    loadOrder().catch((e) => setError(e.message))
  }, [loadOrder])

  const view = useMemo(() => {
    let list = menu.items
    if (catId !== 'all') list = list.filter((i) => i.category_id === catId)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((i) => pick(i, 'title', 'ru').toLowerCase().includes(q))
    return list
  }, [menu.items, catId, query])

  const pendingList = Object.values(pending)
  const pendingSum = pendingList.reduce((s, p) => s + p.price * p.qty, 0)
  const pendingCount = pendingList.reduce((s, p) => s + p.qty, 0)

  function inc(item) {
    setPending((p) => {
      const cur = p[item.id]
      return {
        ...p,
        [item.id]: {
          menu_item_id: item.id,
          title: pick(item, 'title', 'ru'),
          price: Number(item.price) || 0,
          qty: (cur?.qty || 0) + 1,
        },
      }
    })
  }
  function dec(item) {
    setPending((p) => {
      const cur = p[item.id]
      if (!cur) return p
      const qty = cur.qty - 1
      const next = { ...p }
      if (qty <= 0) delete next[item.id]
      else next[item.id] = { ...cur, qty }
      return next
    })
  }

  async function sendToKitchen() {
    if (!pendingList.length || busy) return
    setBusy(true)
    setError('')
    try {
      const r = await api(`/venue/${venue.id}/orders/table/${num}/items`, {
        method: 'POST',
        token,
        body: { items: pendingList },
      })
      setOrder(r.order)
      setPending({})
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function closeTable() {
    if (!order || busy) return
    if (!window.confirm(`Закрыть стол ${num}? Счёт будет завершён.`)) return
    setBusy(true)
    try {
      await api(`/venue/${venue.id}/orders/${order.id}/close`, { method: 'POST', token })
      onBack()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const orderTotal = order?.total || 0

  return (
    <div className="waiter wt-order">
      <div className="wt-order-head">
        <button className="wt-back" onClick={onBack} aria-label="Назад"><ArrowLeft size={22} /></button>
        <span className="wt-order-title">Стол {num}</span>
        <button className="wt-bill-btn" onClick={() => setShowBill(true)}>
          <Receipt size={18} /> {money(orderTotal)}
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="wt-search">
        <Search size={18} />
        <input placeholder="Поиск блюда" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="wt-chips">
        <button className={`wt-chip ${catId === 'all' ? 'on' : ''}`} onClick={() => setCatId('all')}>Все</button>
        {menu.categories.map((c) => (
          <button key={c.id} className={`wt-chip ${catId === c.id ? 'on' : ''}`} onClick={() => setCatId(c.id)}>
            {pick(c, 'title', 'ru')}
          </button>
        ))}
      </div>

      <div className="wt-items">
        {view.length === 0 ? (
          <p className="admin-empty">Ничего не найдено.</p>
        ) : (
          view.map((item) => {
            const q = pending[item.id]?.qty || 0
            return (
              <div key={item.id} className="wt-item">
                <div className="wt-item-info">
                  <span className="wt-item-name">{pick(item, 'title', 'ru')}</span>
                  <span className="wt-item-price">{item.price != null ? money(item.price) : '—'}</span>
                </div>
                {q > 0 ? (
                  <div className="wt-stepper">
                    <button onClick={() => dec(item)} aria-label="минус"><Minus size={18} /></button>
                    <span>{q}</span>
                    <button onClick={() => inc(item)} aria-label="плюс"><Plus size={18} /></button>
                  </div>
                ) : (
                  <button className="wt-add" onClick={() => inc(item)} aria-label="добавить"><Plus size={22} /></button>
                )}
              </div>
            )
          })
        )}
      </div>

      {pendingCount > 0 && (
        <div className="wt-sticky">
          <button className="wt-send" onClick={sendToKitchen} disabled={busy}>
            <span>{busy ? 'Отправляем…' : 'Отправить на кухню'}</span>
            <span className="wt-send-sum">{pendingCount} · {money(pendingSum)}</span>
          </button>
        </div>
      )}

      {showBill && (
        <div className="dish-overlay" onClick={() => setShowBill(false)}>
          <div className="dish-sheet wt-bill" onClick={(e) => e.stopPropagation()}>
            <div className="wt-bill-body">
              <h2 className="dish-title">Счёт · Стол {num}</h2>
              {!order || !order.items.length ? (
                <p className="admin-empty">Пока ничего не заказано.</p>
              ) : (
                <>
                  <div className="wt-bill-list">
                    {order.items.map((it) => (
                      <div key={it.id} className="wt-bill-row">
                        <span>{it.qty}× {it.title_snapshot}</span>
                        <span>{money(Number(it.price_snapshot) * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="wt-bill-total">
                    <span>Итого</span>
                    <span>{money(orderTotal)}</span>
                  </div>
                </>
              )}
              <div className="wt-bill-actions">
                <button className="btn btn-secondary" onClick={() => setShowBill(false)}>Продолжить</button>
                {order && (
                  <button className="btn btn-primary" onClick={closeTable} disabled={busy}>Закрыть стол</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
