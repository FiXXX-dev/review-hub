import React, { useState } from 'react'

// Генератор ссылок для номеров отеля: /admin/rooms/:slug
// Вводишь диапазоны ("101-115" или "101-105, 201, 301-303") —
// получаешь список URL вида /v/slug?room=101 для печати QR.
function parseRooms(input) {
  const rooms = []
  for (const token of input.split(/[,;\s]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const from = parseInt(range[1], 10)
      const to = parseInt(range[2], 10)
      if (to >= from && to - from <= 500) {
        for (let n = from; n <= to; n++) rooms.push(String(n))
      }
    } else if (/^[\w]+$/.test(token)) {
      rooms.push(token)
    }
  }
  return [...new Set(rooms)]
}

export default function RoomLinksPage({ slug }) {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const rooms = parseRooms(input)
  const base = `${window.location.origin}${import.meta.env.BASE_URL}v/${slug}?room=`
  const urls = rooms.map((r) => base + r)

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(urls.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="page">
      <div className="container admin-container">
        <h1 className="admin-title">Ссылки для номеров — {slug}</h1>
        <div className="card admin-form">
          <label className="admin-field">
            <span>Номера комнат (диапазоны через запятую)</span>
            <input
              type="text"
              placeholder="Например: 101-115, 201-210, 301"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          {urls.length > 0 && (
            <>
              <button className="btn btn-primary" type="button" onClick={copyAll}>
                {copied ? '✓ Скопировано' : `Скопировать все (${urls.length})`}
              </button>
              <div className="rooms-list">
                {urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    {u}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
