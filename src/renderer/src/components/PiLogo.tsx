/** The Pi mark on the app icon's dark tile. */
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
      <g transform="translate(512 512) scale(1.13) translate(-400 -400)">
        <path fill="#F09082" d="M165.29 165.29H517.36V400H400V282.65H165.29Z" />
        <path fill="#4D9ABF" d="M165.29 282.65H282.65V400H400V517.36H282.65V634.72H165.29Z" />
        <path fill="#F1BE58" d="M517.36 400H634.72V634.72H517.36Z" />
      </g>
    </svg>
  )
}
