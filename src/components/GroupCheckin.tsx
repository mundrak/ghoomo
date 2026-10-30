"use client";

import { useCallback, useEffect, useState } from "react";
import { inr } from "@/lib/budget";
import { track } from "@/lib/track";
import { CopyButton, WhatsAppLink } from "./Share";
import { inputClass, primaryButton, secondaryButton, Spinner, textLink } from "./ui";

interface GroupStatus {
  size: number;
  count: number;
  lowest: number | null;
  revealAt: number;
  mine: number | null;
}

async function call(url: string, body?: unknown): Promise<{ id?: string; status: GroupStatus }> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

const parseAmount = (text: string) => Number(text.replace(/[^\d]/g, ""));

function Seat({ filled, label }: { filled: boolean; label: string }) {
  const dash = filled ? undefined : "4 4";
  return (
    <div className="flex flex-col items-center gap-1.5 text-xs text-soft">
      <svg width="40" height="44" viewBox="0 0 46 50" aria-hidden="true">
        <rect x="6" y="2" width="34" height="34" rx="8" fill={filled ? "var(--color-ink)" : "none"} stroke="var(--color-ink)" strokeWidth="2" strokeDasharray={dash} />
        <rect x="2" y="30" width="42" height="14" rx="5" fill={filled ? "var(--color-signal)" : "none"} stroke="var(--color-ink)" strokeWidth="2" strokeDasharray={dash} />
      </svg>
      {label}
    </div>
  );
}

/**
 * Group check-in: share one link, each friend adds what they can spend privately, and ghoomo
 * plans to the lowest amount without showing whose it was.
 */
export function GroupCheckin({
  groupId,
  onGroup,
  travellers,
  onUse,
}: {
  groupId: string | null;
  onGroup: (id: string | null) => void;
  travellers: number;
  onUse: (lowest: number, size: number) => void;
}) {
  const [status, setStatus] = useState<GroupStatus | null>(null);
  const [size, setSize] = useState(Math.max(travellers, 2));
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    try {
      setStatus((await call(`/api/groups/${encodeURIComponent(groupId)}`)).status);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [groupId]);

  // Check for new check-ins every so often until everyone's in.
  useEffect(() => {
    if (!groupId) return;
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [groupId, refresh]);

  const submit = async () => {
    const limit = parseAmount(amount);
    if (!limit || limit < 1000) return setError("Enter an amount of at least ₹1,000.");
    setBusy(true);
    setError(null);
    try {
      if (!groupId) {
        const res = await call("/api/groups", { size, limit });
        setStatus(res.status);
        track("group_started");
        if (res.id) onGroup(res.id);
      } else {
        setStatus((await call(`/api/groups/${encodeURIComponent(groupId)}`, { limit })).status);
        track("group_checked_in");
      }
      setAmount("");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const link = groupId && typeof window !== "undefined" ? `${window.location.origin}/?group=${groupId}` : null;
  const askingForMine = !groupId || (status !== null && (status.mine === null || editing));
  const full = status !== null && status.mine === null && status.count >= status.size;

  return (
    <section aria-labelledby="checkin-title" className="grid gap-8 border-t border-line pt-10 md:grid-cols-[1.1fr_1fr]">
      <div>
        <h2 id="checkin-title" className="font-wide text-2xl font-bold sm:text-3xl">
          Group check-in
        </h2>
        <p className="mt-2 max-w-[48ch] text-soft">
          Not sure what everyone can spend? Share one link. Each friend adds their limit privately, and ghoomo plans to the lowest one without
          showing whose it was.
        </p>

        {askingForMine && !full && (
          <form
            className="mt-5 flex flex-wrap items-end gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {!groupId && (
              <label className="block text-sm font-semibold text-soft">
                How many of you
                <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={`${inputClass} mt-1 w-28`}>
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n} people
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm font-semibold text-soft">
              {groupId ? "What you can spend, all in" : "What you can spend (only you see this)"}
              <input
                inputMode="numeric"
                placeholder="₹8,000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className={`${inputClass} mt-1 w-44`}
              />
            </label>
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? <Spinner /> : null}
              {groupId ? (status?.mine ? "Update mine" : "Check in") : "Start check-in"}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-short-ink">
            {error}
          </p>
        )}

        {link && (
          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-soft">Send this to the group</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={link} label="Copy check-in link" onCopy={() => track("copy_link")} />
              <WhatsAppLink
                text={`Add what you can spend for our trip. It's private, and we'll plan to the lowest amount: ${link}`}
                onShare={() => track("share_whatsapp")}
              />
            </div>
          </div>
        )}
      </div>

      <div aria-live="polite">
        {status ? (
          <>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: status.size }, (_, i) => (
                <Seat key={i} filled={i < status.count} label={i < status.count ? "In" : "Waiting"} />
              ))}
            </div>
            <p className="mt-3 text-sm text-soft">
              {status.count} of {status.size} checked in.
              {status.mine !== null && !editing && (
                <>
                  {" "}
                  You added {inr(status.mine)}.{" "}
                  <button type="button" onClick={() => setEditing(true)} className={textLink}>
                    Change it
                  </button>
                </>
              )}
            </p>
            {full && <p className="mt-2 text-sm font-semibold">Everyone in this group has already added theirs.</p>}
            <div className="mt-5 rounded-xl border-[1.5px] border-line bg-white p-5">
              {status.lowest !== null ? (
                <>
                  <p>
                    Plan to <span className="text-2xl font-extrabold tabular-nums">{inr(status.lowest)}</span> each. That&apos;s the lowest limit in
                    the group, and nobody sees whose it was.
                  </p>
                  <button type="button" onClick={() => onUse(status.lowest!, status.size)} className={`${secondaryButton} mt-3`}>
                    Use {inr(status.lowest)} on the board
                  </button>
                </>
              ) : (
                <p className="text-soft">
                  The amount to plan to shows once {status.revealAt} people are in, so nobody&apos;s limit can be guessed.
                </p>
              )}
            </div>
            {groupId && (
              <button type="button" onClick={() => onGroup(null)} className={`${textLink} mt-4 text-sm`}>
                Leave this check-in
              </button>
            )}
          </>
        ) : groupId ? (
          <p className="text-soft">Loading the group…</p>
        ) : (
          <div className="flex flex-wrap gap-3 opacity-60" aria-hidden="true">
            {Array.from({ length: Math.min(size, 8) }, (_, i) => (
              <Seat key={i} filled={false} label="Waiting" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
