/**
 * Parse OCR text from a printed route sheet.
 * Expects columns: Name, Address, Service Type; remaining columns treated as right-side comments (heat only).
 */

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} text raw OCR
 * @returns {Array<{ name: string, address: string, routeType: 'guest'|'check', heat: boolean }>}
 */
export function parseRouteSheetText(text) {
  const raw = norm(text);
  if (!raw) return [];

  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\bname\b/i.test(l) && /\baddress\b/i.test(l)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[-_=.\s]+$/.test(line)) continue;
    if (/^page\b/i.test(line)) continue;

    const parts = line.split(/\t+/).length > 1 ? line.split(/\t+/) : line.split(/\s{2,}/);
    const cleaned = parts.map((p) => norm(p)).filter(Boolean);
    if (cleaned.length < 2) continue;

    const name = cleaned[0];
    const address = cleaned[1];
    const serviceType = cleaned[2] || "";
    const comments = cleaned.slice(3).join(" ");

    if (!name || name.length < 2) continue;
    if (/^name$/i.test(name) && /^address$/i.test(address)) continue;

    const routeType = /\bcheck\b/i.test(serviceType) ? "check" : "guest";
    const heat = /\bheat\b/i.test(comments);

    rows.push({ name, address, routeType, heat });
  }

  return rows;
}
