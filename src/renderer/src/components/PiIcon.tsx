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
    >
      <path d="M4 7h16" />
      <path d="M9 7v12" />
      <path d="M16 7v11a1.5 1.5 0 0 0 1.5 1.5" />
    </svg>
  );
}
