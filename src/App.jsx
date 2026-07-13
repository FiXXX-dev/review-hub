import React from 'react'
import VenuePage from './VenuePage.jsx'
import AdminPage from './AdminPage.jsx'
import RoomLinksPage from './RoomLinksPage.jsx'
import ServicesAdminPage from './ServicesAdminPage.jsx'
import LandingPage from './LandingPage.jsx'

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

  const slug = getSlug()

  // страница заведения — только /v/:slug («не найдено» показывает она сама,
  // если slug не существует); всё остальное, включая корень, — лендинг halo
  return slug ? <VenuePage slug={slug} /> : <LandingPage />
}
