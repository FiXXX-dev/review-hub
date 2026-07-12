import React from 'react'
import VenuePage from './VenuePage.jsx'
import AdminPage from './AdminPage.jsx'
import RoomLinksPage from './RoomLinksPage.jsx'

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
  if (/\/admin\/?$/.test(window.location.pathname)) {
    return <AdminPage />
  }

  const slug = getSlug()

  if (!slug) {
    return (
      <div className="page center">
        <div className="notfound">
          <div className="notfound-emoji">🔍</div>
          <h1>Заведение не найдено</h1>
          <p>Проверьте ссылку или отсканируйте QR-код ещё раз.</p>
        </div>
      </div>
    )
  }

  return <VenuePage slug={slug} />
}
