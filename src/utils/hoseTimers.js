export function hosePoolKey(propertySlug) {
  return `hose_pool_${propertySlug}`;
}

export function hoseSpaKey(propertySlug) {
  return `hose_spa_${propertySlug}`;
}

export function getPoolStart(propertySlug) {
  try {
    const v = localStorage.getItem(hosePoolKey(propertySlug));
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function getSpaStart(propertySlug) {
  try {
    const v = localStorage.getItem(hoseSpaKey(propertySlug));
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function setPoolStart(propertySlug, timestamp) {
  try {
    localStorage.setItem(hosePoolKey(propertySlug), String(timestamp));
  } catch {
    /* quota / private mode */
  }
}

export function setSpaStart(propertySlug, timestamp) {
  try {
    localStorage.setItem(hoseSpaKey(propertySlug), String(timestamp));
  } catch {
    /* quota / private mode */
  }
}

export function clearPool(propertySlug) {
  try {
    localStorage.removeItem(hosePoolKey(propertySlug));
  } catch {
    /* ignore */
  }
}

export function clearSpa(propertySlug) {
  try {
    localStorage.removeItem(hoseSpaKey(propertySlug));
  } catch {
    /* ignore */
  }
}

/** Elapsed whole seconds from start timestamp to now */
export function elapsedSecondsSince(startTimestamp, nowMs = Date.now()) {
  return Math.max(0, Math.floor((nowMs - startTimestamp) / 1000));
}

export function formatHoseElapsed(totalSeconds) {
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
