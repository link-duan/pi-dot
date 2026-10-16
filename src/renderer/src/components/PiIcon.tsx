/** The Pi mark in the current text color, its three blocks told apart by opacity. */
export function PiIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="165 165 470 470" fill="currentColor" className={className} aria-hidden>
      <path d="M165.29 165.29H517.36V400H400V282.65H165.29Z" />
      <path opacity="0.65" d="M165.29 282.65H282.65V400H400V517.36H282.65V634.72H165.29Z" />
      <path opacity="0.4" d="M517.36 400H634.72V634.72H517.36Z" />
    </svg>
  )
}
