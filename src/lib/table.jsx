import React, { createContext, useContext, useEffect } from 'react'

// Контекст стола: slug + table живут в пути (/v/:slug/t/:table[...]),
// все внутренние ссылки заведения строятся ТОЛЬКО отсюда — чтобы номер
// стола не терялся при переходах меню ↔ счёт ↔ страница заведения.

const storageKey = (slug) => `halo:table:${slug}`

export function saveTable(slug, table) {
  try {
    sessionStorage.setItem(storageKey(slug), String(table))
  } catch {
    /* приватный режим */
  }
}

export function loadTable(slug) {
  try {
    return sessionStorage.getItem(storageKey(slug)) || null
  } catch {
    return null
  }
}

// Канонический URL внутри заведения: venuePath('bon', 5, '/menu') → /v/bon/t/5/menu
export function venuePath(slug, table, suffix = '') {
  const base = import.meta.env.BASE_URL
  return `${base}v/${slug}${table ? `/t/${encodeURIComponent(table)}` : ''}${suffix}`
}

const TableCtx = createContext({ slug: null, table: null })

export function TableProvider({ slug, table, children }) {
  // первый вход со столом — запоминаем на сессию (для старых ссылок без стола)
  useEffect(() => {
    if (slug && table) saveTable(slug, table)
  }, [slug, table])
  return <TableCtx.Provider value={{ slug, table }}>{children}</TableCtx.Provider>
}

export function useTable() {
  const { slug, table } = useContext(TableCtx)
  return {
    slug,
    table,
    venueUrl: venuePath(slug, table),
    menuUrl: venuePath(slug, table, '/menu'),
    billUrl: table ? venuePath(slug, table, '/bill') : null,
  }
}
