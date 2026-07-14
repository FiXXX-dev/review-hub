import React from 'react'

// Единственный источник геометрии лого halo: три концентрических
// почти полных кольца с разрывом снизу (как в public/halo.svg и favicon).
// Цвет — через CSS color (stroke="currentColor").

export function HaloIcon({ size = 24, strokeWidth = 9, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <circle
          cx="50" cy="52" r="40" strokeWidth={strokeWidth}
          strokeDasharray="188.5 62.8" strokeDashoffset="-31.4"
          transform="rotate(90 50 52)"
        />
        <circle
          cx="50" cy="52" r="26" strokeWidth={strokeWidth}
          strokeDasharray="131.6 31.8" strokeDashoffset="-15.9"
          transform="rotate(90 50 52)"
        />
        <circle
          cx="50" cy="52" r="12" strokeWidth={strokeWidth}
          strokeDasharray="63.9 11.5" strokeDashoffset="-5.75"
          transform="rotate(90 50 52)"
        />
      </g>
    </svg>
  )
}

export function HaloLogo({ size = 30, className = '' }) {
  return (
    <span className={`halo-logo ${className}`}>
      <HaloIcon size={size} className="halo-logo-icon" />
      <span className="halo-logo-word">halo</span>
    </span>
  )
}
