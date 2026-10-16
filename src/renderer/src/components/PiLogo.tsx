export function PiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden>
      <defs>
        <linearGradient id="pi-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F1F24" />
          <stop offset="100%" stopColor="#121214" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#pi-logo-bg)" />
      <g fill="none" stroke="#F4F0E6" strokeWidth="84" strokeLinecap="round" strokeLinejoin="round">
        <path d="M270 388H754" />
        <path d="M400 388V752" />
        <path d="M640 388V688Q640 752 728 752" />
      </g>
    </svg>
  )
}
