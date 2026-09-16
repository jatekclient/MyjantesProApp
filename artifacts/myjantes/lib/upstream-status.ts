type Listener = (degraded: boolean) => void;

let degraded = false;
let lastDegradedAt = 0;
let clearTimer: any = null;
const listeners = new Set<Listener>();

const AUTO_CLEAR_MS = 60_000;

function notify() {
  listeners.forEach((l) => {
    try { l(degraded); } catch {}
  });
}

export function isUpstreamDegraded(): boolean {
  return degraded;
}

export function reportUpstreamError(status: number, endpoint?: string): void {
  if (status < 500 || status >= 600) return;
  lastDegradedAt = Date.now();
  if (!degraded) {
    degraded = true;
    notify();
  }
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    if (Date.now() - lastDegradedAt >= AUTO_CLEAR_MS - 100) {
      reportUpstreamRecovered();
    }
  }, AUTO_CLEAR_MS);
  if (endpoint) {
    console.warn(`[UpstreamStatus] Service degraded (${status}) at ${endpoint}`);
  }
}

export function reportUpstreamRecovered(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (degraded) {
    degraded = false;
    notify();
  }
}

export function subscribeUpstreamStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(degraded);
  return () => {
    listeners.delete(listener);
  };
}
