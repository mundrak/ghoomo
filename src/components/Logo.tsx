/** A solid dot (where you are), a dotted route, and an open ring (where you're going). */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg width="42" height="20" viewBox="0 0 44 22" aria-hidden="true" className={className}>
      <circle cx="6" cy="15" r="5.5" fill="currentColor" />
      <path d="M13 11 Q22 0 32 7" stroke="currentColor" strokeWidth="2.5" strokeDasharray="1 4.5" strokeLinecap="round" fill="none" />
      <circle cx="37" cy="8" r="4.6" stroke="currentColor" strokeWidth="2.8" fill="var(--color-signal)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark />
      <span className="text-[22px] font-extrabold tracking-tight">ghoomo</span>
    </span>
  );
}
