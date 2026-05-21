/**
 * Small notification badge for nav items.
 * - Number: brass circle with count (caps at "9+")
 * - Dot: small indicator dot
 */
export function NavBadge({ value }: { value: number | 'dot' }) {
  if (value === 'dot') {
    return (
      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brass animate-badge-pop" />
    )
  }

  if (value <= 0) return null

  const display = value > 9 ? '9+' : String(value)

  return (
    <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brass px-0.5 text-[10px] font-bold leading-none text-on-brass animate-badge-pop">
      {display}
    </span>
  )
}
