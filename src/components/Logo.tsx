/** A solid dot (where you are), a dotted route, and an open ring (where you're going). Drawn in ink. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg width="34" height="17" viewBox="0 0 44 22" aria-hidden="true" className={className}>
      <circle cx="6" cy="15" r="4.5" fill="currentColor" />
      <path d="M13 11 Q22 0 32 7" stroke="currentColor" strokeWidth="1.8" strokeDasharray="0.6 4" strokeLinecap="round" fill="none" />
      <circle cx="37" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">ghoomo</span>
    </span>
  );
}
