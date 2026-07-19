import React from 'react'
import VenuePage from './VenuePage.jsx'
import AdminPage from './AdminPage.jsx'
import RoomLinksPage from './RoomLinksPage.jsx'
import ServicesAdminPage from './ServicesAdminPage.jsx'
import LandingPage from './LandingPage.jsx'
import CabinetPage from './CabinetPage.jsx'
import MenuPage from './MenuPage.jsx'
import BillPage from './BillPage.jsx'
import NoTableScreen from './NoTableScreen.jsx'
import { LangProvider } from './lib/i18n.jsx'
import { TableProvider, loadTable, venuePath } from './lib/table.jsx'

// клиентский редирект (для GH Pages/preview; на Railway тот же кейс
// перехватывает express настоящим 301 ещё до загрузки SPA)
function Redirect({ to }) {
  window.location.replace(to)
  return (
    <div className="page center">
      <div className="spinner" />
    </div>
  )
}

// query-строка без table — remainder переносим на канонический URL (?room, ?lang…)
function restQuery() {
  const p = new URLSearchParams(window.location.search)
  p.delete('table')
  const s = p.toString()
  return s ? `?${s}` : ''
}

export default function App() {
  const path = window.location.pathname
  const qTable =
    new URLSearchParams(window.location.search).get('table')?.trim().slice(0, 20) || null

  const roomsMatch = path.match(/\/admin\/rooms\/([\w-]+)\/?$/)
  if (roomsMatch) {
    return <RoomLinksPage slug={roomsMatch[1]} />
  }
  const servicesMatch = path.match(/\/admin\/services\/([\w-]+)\/?$/)
  if (servicesMatch) {
    return <ServicesAdminPage slug={servicesMatch[1]} />
  }
  if (/\/admin\/?$/.test(path)) {
    return <AdminPage />
  }
  if (/\/cabinet\/?$/.test(path)) {
    return <CabinetPage />
  }

  // ── канонические роуты стола: /v/:slug/t/:table[/menu|/bill] ──
  const tMatch = path.match(/\/v\/([\w-]+)\/t\/([\w.-]+)(\/menu|\/bill)?\/?$/)
  if (tMatch) {
    const [, slug, table, sub] = tMatch
    const page =
      sub === '/menu' ? (
        <MenuPage slug={slug} />
      ) : sub === '/bill' ? (
        <BillPage slug={slug} table={table} />
      ) : (
        <VenuePage slug={slug} table={table} />
      )
    return (
      <LangProvider>
        <TableProvider slug={slug} table={table}>
          {page}
        </TableProvider>
      </LangProvider>
    )
  }

  // ── старые ссылки (?table=N — печатные QR) и роуты без стола ──
  const billMatch = path.match(/\/v\/([\w-]+)\/bill\/?$/)
  if (billMatch) {
    const slug = billMatch[1]
    const t = qTable || loadTable(slug)
    if (t) return <Redirect to={venuePath(slug, t, '/bill') + restQuery()} />
    // стола нет нигде — счёт недоступен, просим отсканировать табличку
    return (
      <LangProvider>
        <NoTableScreen />
      </LangProvider>
    )
  }

  const menuMatch = path.match(/\/v\/([\w-]+)\/menu\/?$/)
  if (menuMatch) {
    const slug = menuMatch[1]
    const t = qTable || loadTable(slug)
    if (t) return <Redirect to={venuePath(slug, t, '/menu') + restQuery()} />
    // общее меню без стола — легально (ссылка из блока «Меню» у любых вертикалей)
    return (
      <LangProvider>
        <TableProvider slug={slug} table={null}>
          <MenuPage slug={slug} />
        </TableProvider>
      </LangProvider>
    )
  }

  const slugMatch = path.match(/\/v\/([\w-]+)\/?$/)
  if (slugMatch) {
    const slug = slugMatch[1]
    const t = qTable || loadTable(slug)
    if (t) return <Redirect to={venuePath(slug, t) + restQuery()} />
    // страница заведения без стола — легальна (отели/салоны, общий QR у входа)
    return (
      <LangProvider>
        <TableProvider slug={slug} table={null}>
          <VenuePage slug={slug} />
        </TableProvider>
      </LangProvider>
    )
  }

  // всё остальное, включая корень, — лендинг halo
  return (
    <LangProvider>
      <LandingPage />
    </LangProvider>
  )
}
