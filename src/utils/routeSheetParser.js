/**
 * Best-effort parsing of OCR text from a paper route sheet.
 * No Name/Address headers required — line-by-line, always returns whatever rows can be inferred.
 */

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Line looks like "24201 Caribbean Way" (digits + street). */
function isProbableAddressLine(line) {
  const t = line.trim();
  if (t.length < 4) return false;
  return /^\d{1,6}\s+[A-Za-z]/.test(t);
}

function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^[-_=.\s]+$/i.test(t)) return true;
  if (/^page\s+\d/i.test(t)) return true;
  return false;
}

/**
 * Name is usually the nearest meaningful line above the address.
 */
function pickNameForAddress(lines, addressIndex) {
  for (let j = addressIndex - 1; j >= 0 && j >= addressIndex - 5; j--) {
    const L = lines[j];
    if (isNoiseLine(L)) continue;
    if (isProbableAddressLine(L)) continue;
    const t = L.trim();
    if (t.length < 2) continue;
    if (/^(check|clean|guest)\b/i.test(t) && t.length < 20) continue;
    return t;
  }
  return `Stop ${addressIndex + 1}`;
}

function nearbyBlock(lines, index, before, after) {
  const a = Math.max(0, index - before);
  const b = Math.min(lines.length, index + after + 1);
  return lines.slice(a, b).join(" ");
}

/**
 * @param {string} text raw OCR
 * @returns {Array<{ name: string, address: string, routeType: 'guest'|'check', heat: boolean }>}
 */
export function parseRouteSheetText(text) {
  const raw = norm(text);
  if (!raw) return [];

  const lines = raw.split(/\n/).map((l) => l.trim());

  const rows = [];
  const seenAddr = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isProbableAddressLine(line)) continue;

    const address = norm(line);
    const addrKey = address.toLowerCase();
    if (seenAddr.has(addrKey)) continue;
    seenAddr.add(addrKey);

    const name = norm(pickNameForAddress(lines, i));
    const context = nearbyBlock(lines, i, 2, 4);
    const routeType = /\bcheck\b/i.test(context) ? "check" : "guest";
    const heat = /\bheat\b/i.test(context);

    rows.push({ name, address, routeType, heat });
  }

  return rows;
}
