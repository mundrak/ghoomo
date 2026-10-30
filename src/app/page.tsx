import { App } from "@/components/App";
import { storageAvailable } from "@/lib/kv";

// Saved trips and group check-in need storage that outlives a request (Redis).
// Without it they stay hidden rather than half-working. Redeploy after connecting Redis.
export default function Page() {
  return <App storage={storageAvailable} />;
}
