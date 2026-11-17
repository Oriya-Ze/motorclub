import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Requests the first screen does not need (unread counters, settings, the desktop sidebar) wait until the first
 * screen's own requests have come back. On a cold API every request in flight at once starts its own server, so
 * holding these back means fewer cold starts at app open, and they then reach a server that is already up.
 */
const MAX_WAIT_MS = 4000;

let settled = false;
let started = false;
const listeners = new Set<() => void>();

function settle() {
  if (settled) return;
  settled = true;
  listeners.forEach((listener) => listener());
  listeners.clear();
}

/** Starts watching the query cache once; settles when nothing is fetching any more, or after MAX_WAIT_MS. */
export function startBootGate(queryClient: QueryClient) {
  if (started || settled) return;
  started = true;
  let sawFetch = false;
  const timer = window.setTimeout(done, MAX_WAIT_MS);
  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    const fetching = queryClient.isFetching();
    if (fetching > 0) sawFetch = true;
    else if (sawFetch) done();
  });
  function done() {
    window.clearTimeout(timer);
    unsubscribe();
    // Let the first screen paint before the next wave goes out.
    window.setTimeout(settle, 0);
  }
}

/** Runs fn now if the first screen is in, or as soon as it is. */
export function whenBootSettled(fn: () => void) {
  if (settled) fn();
  else listeners.add(fn);
}

function subscribe(listener: () => void) {
  if (settled) return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBootSettled(): boolean {
  return useSyncExternalStore(subscribe, () => settled, () => settled);
}
