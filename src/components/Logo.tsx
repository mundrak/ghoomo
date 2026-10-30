/** The ghoomo mark: where you are (solid) to where you're going (open), joined by a dotted route. */
export function LogoMark({ className = "h-6 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden="true">
      <path d="M8.5 15.5 C 14 3, 24 3, 29.5 8" fill="none" stroke="#33291f" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1 4.6" />
      <circle cx="6" cy="17" r="4.5" fill="#e2603f" />
      <circle cx="33" cy="9" r="4.2" fill="none" stroke="#33291f" strokeWidth="2.4" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-xl tracking-tight text-ink">ghoomo</span>
    </span>
  );
}
