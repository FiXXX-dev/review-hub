import React from 'react'
import VenuePage from './VenuePage.jsx'
import AdminPage from './AdminPage.jsx'
import RoomLinksPage from './RoomLinksPage.jsx'
import ServicesAdminPage from './ServicesAdminPage.jsx'
import LandingPage from './LandingPage.jsx'
import CabinetPage from './CabinetPage.jsx'
import MenuPage from './MenuPage.jsx'
import BillPage from './BillPage.jsx'
import { LangProvider } from './lib/i18n.jsx'

function getSlug() {
  // не привязываемся к началу пути: на GitHub Pages сайт живёт под /review-hub/
  const match = window.location.pathname.match(/\/v\/([\w-]+)\/?$/)
  return match ? match[1] : null
}

export default function App() {
  const roomsMatch = window.location.pathname.match(/\/admin\/rooms\/([\w-]+)\/?$/)
  if (roomsMatch) {
    return <RoomLinksPage slug={roomsMatch[1]} />
  }
  const servicesMatch = window.location.pathname.match(/\/admin\/services\/([\w-]+)\/?$/)
  if (servicesMatch) {
    return <ServicesAdminPage slug={servicesMatch[1]} />
  }
  if (/\/admin\/?$/.test(window.location.pathname)) {
    return <AdminPage />
  }
  if (/\/cabinet\/?$/.test(window.location.pathname)) {
    return <CabinetPage />
  }

  // /v/:slug/menu — публичная страница меню
  const menuMatch = window.location.pathname.match(/\/v\/([\w-]+)\/menu\/?$/)
  if (menuMatch) {
    return (
      <LangProvider>
        <MenuPage slug={menuMatch[1]} />
      </LangProvider>
    )
  }

  // /v/:slug/bill — гостевой счёт стола (read-only)
  const billMatch = window.location.pathname.match(/\/v\/([\w-]+)\/bill\/?$/)
  if (billMatch) {
    return <BillPage slug={billMatch[1]} />
  }

  const slug = getSlug()

  // страница заведения — только /v/:slug («не найдено» показывает она сама,
  // если slug не существует); всё остальное, включая корень, — лендинг halo
  return <LangProvider>{slug ? <VenuePage slug={slug} /> : <LandingPage />}</LangProvider>
}
