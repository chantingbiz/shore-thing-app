/** Lets Finish Job trigger an immediate save while a property detail ReadingsForm is mounted. */
let flushWork = null;

export function registerWorkFlush(fn) {
  flushWork = fn;
}

export function unregisterWorkFlush() {
  flushWork = null;
}

export function flushPendingWorkNow() {
  flushWork?.();
}
