import React, { useId } from 'react'

// Иконка Instagram: фирменный градиентный бейдж + белый глиф камеры.
// lucide убрал брендовые иконки, поэтому рисуем сами.
export function InstagramIcon({ size = 20, className = '' }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="5%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="60%" stopColor="#D6249F" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5.6" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
        <rect x="6" y="6" width="12" height="12" rx="3.4" />
        <circle cx="12" cy="12" r="2.9" />
      </g>
      <circle cx="16.1" cy="7.9" r="1.15" fill="#fff" />
    </svg>
  )
}
