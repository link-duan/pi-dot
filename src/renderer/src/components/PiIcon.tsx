export function PiIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5.2 6.9H18.8" />
      <path d="M8.9 6.9V17.2" />
      <path d="M15.6 6.9V15.3Q15.6 17.2 18.1 17.2" />
    </svg>
  );
}

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
      <g
        fill="none"
        stroke="#F4F0E6"
        strokeWidth="84"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M270 388H754" />
        <path d="M400 388V752" />
        <path d="M640 388V688Q640 752 728 752" />
      </g>
    </svg>
  );
}
