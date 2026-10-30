import type { EventName, FeedbackReason } from "./events";

/** Counts an anonymous usage event from the browser. Fire and forget: never blocks or throws. */
export function track(name: EventName, reason?: FeedbackReason) {
  try {
    const body = JSON.stringify(reason ? { name, reason } : { name });
    if (navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Counting must never break the app.
  }
}
