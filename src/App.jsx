import React from 'react'
import VenuePage from './VenuePage.jsx'

function getSlug() {
  const match = window.location.pathname.match(/^\/v\/([\w-]+)\/?$/)
  return match ? match[1] : null
}

export default function App() {
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
