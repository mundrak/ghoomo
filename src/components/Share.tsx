"use client";

import { useState } from "react";
import { secondaryButton } from "./ui";

/** Copies text to the clipboard and says so. Falls back to showing the text if copying is blocked. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <button
        type="button"
        className={secondaryButton}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
            setTimeout(() => setState("idle"), 2000);
          } catch {
            setState("failed");
          }
        }}
      >
        {state === "copied" ? "Copied" : label}
      </button>
      {state === "failed" && <input readOnly value={text} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm" aria-label="Link to copy" />}
    </>
  );
}

/** Opens WhatsApp with a message ready to send. */
export function WhatsAppLink({ text, label = "Share on WhatsApp" }: { text: string; label?: string }) {
  return (
    <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z" />
        <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a3.5 3.5 0 0 1-2-2l1-1-1-2z" />
      </svg>
      {label}
    </a>
  );
}
