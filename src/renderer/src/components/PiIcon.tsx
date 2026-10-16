export function PiIcon({ className = 'size-5' }: { className?: string }) {
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
  )
}
