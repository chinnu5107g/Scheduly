export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Scheduly logo">
      <rect width="32" height="32" rx="9" fill="#2563EB" />
      <rect x="7" y="8.5" width="18" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M7 13.5h18" stroke="#fff" strokeWidth="2" />
      <path d="M12 6.5v4M20 6.5v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 19l2.5 2.5 4.5-4.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
