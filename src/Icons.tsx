import type { CSSProperties } from 'react'
import hawtendMark from './assets/hawtend-mark-128.png'

export function BrandMark({ size = 40 }: { size?: number }) {
  return <img className="brand-mark" src={hawtendMark} width={size} height={size} alt="" aria-hidden="true" draggable={false} />
}

export function Icon({ name, size = 20, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    book: <><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1V5Z" /><path d="M12 6v15M6 9l3 1m-3 3 3 1m6-4 3-1m-3 5 3-1" /></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" /><path d="M9 21v-8h6v8" /></>,
    timeline: <><path d="M3 12h18M7 5v4m10 6v4" /><circle cx="7" cy="12" r="2" /><circle cx="17" cy="12" r="2" /></>,
    flag: <><path d="M5 22V3c4-3 9 3 14 0v10c-5 3-10-3-14 0" /></>,
    wallet: <><path d="M20 7V4H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6" /><path d="M20 11h-5v5h5" /><path d="M17 13.5h.01" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    sprout: <><path d="M12 21v-8c0-6 5-9 9-9 0 6-3 10-9 10M12 16C4 16 3 11 3 7c7 0 9 4 9 9" /></>,
    mountain: <><path d="m2 20 7-14 4 7 3-5 6 12H2Z" /><path d="m6 12 3 2 3-2" /><circle cx="18" cy="4" r="2" /></>,
    heart: <path d="M20.8 5.6c-2.4-2.4-5.3-1.5-8.8 2-3.5-3.5-6.4-4.4-8.8-2-3.3 3.3-.7 7.1 8.8 14.4 9.5-7.3 12.1-11.1 8.8-14.4Z" />,
    star: <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2L3 9.6l6.2-.9L12 3Z" />,
    edit: <><path d="m4 16 11-11 4 4L8 20H4v-4Zm10-10 4 4M14 21h7" /></>,
    cloud: <path d="M6 18a5 5 0 0 1-.6-10 7 7 0 0 1 13.3 1A4.5 4.5 0 0 1 19 18H6Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    settings: <><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z" /><circle cx="12" cy="12" r="3" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    leaf: <><path d="M20 3c2 13-3 18-10 16C1 17 3 8 20 3ZM5 21 16 10" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M7 14h.1m5 0h.1m5 0h.1M7 17h.1m5 0h.1" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>{paths[name] || paths.book}</svg>
}

export function Landscape() {
  return <svg className="landscape" viewBox="0 0 420 250" role="img" aria-label="暖阳下的山川，一条小路通向远方">
    <defs><clipPath id="landscape-clip"><rect x="6" y="6" width="408" height="238" rx="118" /></clipPath></defs>
    <g clipPath="url(#landscape-clip)">
      <rect width="420" height="250" fill="#eee5d3" />
      <circle cx="291" cy="82" r="31" fill="#d9ac69" />
      <path d="M0 148 82 56l80 107 91-42 100-24 67 56v97H0Z" fill="#b2bba6" />
      <path d="M0 171 74 139l100 65 105-83 46 49 95-18v98H0Z" fill="#8e9d84" />
      <path d="M0 210c70-98 158-4 203 9 65 18 130-32 217-22v53H0Z" fill="#627a63" />
      <path d="M271 151c-76 10-84 39-62 51 31 15 48 15 21 48h-35c36-23 16-27 3-36-35-26-23-48 73-63Z" fill="#e7dec5" />
      <path d="m74 92 8-12 12 21-12-5-8 3" fill="#e8e9db" opacity=".7" />
      <path d="m102 64 7-3 8 3m8-15 8-3 7 3" stroke="#738574" fill="none" strokeWidth="2" />
      <path d="M55 232v-42m-16 20 16-32 16 32m-13 16 17-35 18 35m-18 0v16" stroke="#445f4d" fill="#445f4d" strokeWidth="3" />
    </g>
    <rect x="6" y="6" width="408" height="238" rx="118" stroke="#fbf8ef" strokeWidth="2" fill="none" />
  </svg>
}
