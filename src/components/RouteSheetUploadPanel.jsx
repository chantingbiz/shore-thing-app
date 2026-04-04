import { useCallback, useEffect, useRef, useState } from "react";
import { getPropertiesForTechnician } from "../lib/api.js";
import { applyRouteSheetReviewRows } from "../utils/routeSheetApply.js";
import { buildRouteSheetReviewRows } from "../utils/routeSheetMatch.js";
import RouteSheetSummaryModal from "./RouteSheetSummaryModal.jsx";
import styles from "./RouteSheetUploadPanel.module.css";

const PARSE_ROUTE_SHEET_URL = "/.netlify/functions/parse-route-sheet";

/**
 * Lowercase + collapse whitespace + trim — for Service Type / comments columns only (not full row).
 * @param {unknown} raw
 */
function normLowerColumn(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every distinct string value on the row object (any key) so heat scan misses no model/OCR field.
 * @param {Record<string, unknown>} row
 */
function collectAllRowStrings(row) {
  if (!row || typeof row !== "object") return "";
  const seen = new Set();
  const chunks = [];
  for (const v of Object.values(row)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    chunks.push(t);
  }
  return chunks.join(" ");
}

/**
 * Service Type column only (second column from the right in the sheet layout).
 * @param {Record<string, unknown>} row
 */
function serviceTypeColumnOnly(row) {
  const v =
    row.serviceType ??
    row.service_type ??
    row["Service Type"] ??
    "";
  return String(v ?? "").trim();
}

/**
 * Owner Information / Comments column (rightmost context column).
 * @param {Record<string, unknown>} row
 */
function ownerCommentsColumnText(row) {
  const v =
    row.ownerComments ??
    row.owner_comments ??
    row["Owner Information / Comments"] ??
    row.ownerInformationComments ??
    row.owner_information_comments ??
    "";
  return String(v ?? "").trim();
}

/**
 * Pool heat: case-insensitive "heat" anywhere in full row text; light OCR variants on compact string.
 * @param {string} raw — all string fields joined for the row
 */
function rowIndicatesHeat(raw) {
  if (!raw) return false;
  if (/heat/i.test(raw)) return true;
  const compact = String(raw)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (compact.includes("heat")) return true;
  if (compact.includes("heot") || compact.includes("heet") || compact.includes("h3at")) return true;
  return false;
}

/**
 * Conservative guest/check: only Service Type may produce "check". "clean" in Service Type or rightmost
 * comments → guest. Full row text is never used for check. Default guest.
 *
 * @param {string} serviceTypeLower — normalized Service Type only
 * @param {string} commentsLower — normalized Owner / comments column only
 */
function deriveGuestCheck(serviceTypeLower, commentsLower) {
  if (serviceTypeLower.includes("check")) return "check";
  if (serviceTypeLower.includes("clean")) return "guest";
  if (commentsLower.includes("clean")) return "guest";
  return "guest";
}

/**
 * Preview rules:
 * - heat: all row strings; /heat/i + compact OCR (heot, heet, h3at)
 * - guest/check: Service Type + comments columns only, exact decision order above
 * - optional: pool heat on → force guest (matches save path)
 *
 * @param {unknown} data
 * @returns {Array<{ name: string, address: string, routeType: 'guest'|'check', heat: boolean }>}
 */
function normalizeParsedRows(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.name ?? "").trim();
    const address = String(row.address ?? "").trim();

    const heatScanText = collectAllRowStrings(row);
    const heat = rowIndicatesHeat(heatScanText);

    const serviceTypeLower = normLowerColumn(serviceTypeColumnOnly(row));
    const commentsLower = normLowerColumn(ownerCommentsColumnText(row));
    let routeType = deriveGuestCheck(serviceTypeLower, commentsLower);

    if (heat) routeType = "guest";

    if (!name && !address) continue;
    out.push({ name, address, routeType, heat });
  }
  return out;
}

/**
 * @param {File} file
 * @returns {Promise<{ imageBase64: string, mimeType: string }>}
 */
function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.replace(/\r?\n/g, ""));
      if (!m) {
        reject(new Error("Could not read image as base64."));
        return;
      }
      resolve({
        mimeType: m[1]?.trim() || file.type || "image/jpeg",
        imageBase64: m[2].trim(),
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * @param {{ technicianSlug: string, onApplied?: () => void, routeCountHint?: number }} props
 */
export default function RouteSheetUploadPanel({ technicianSlug, onApplied, routeCountHint = 0 }) {
  const tech = (technicianSlug ?? "").toLowerCase();
  const fileRef = useRef(null);
  const [dbCount, setDbCount] = useState(0);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [parseErr, setParseErr] = useState(null);
  const [softHint, setSoftHint] = useState(null);
  const [reviewRows, setReviewRows] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [summaryModal, setSummaryModal] = useState(null);

  const refreshDbCount = useCallback(async () => {
    if (!tech) return;
    try {
      const rows = await getPropertiesForTechnician(tech);
      setDbCount(rows.length);
    } catch (e) {
      console.error(e);
      setDbCount(0);
    }
  }, [tech]);

  useEffect(() => {
    void refreshDbCount();
  }, [refreshDbCount]);

  const runOcr = useCallback(
    async (file) => {
      if (!file || !tech) return;
      setParseErr(null);
      setSoftHint(null);
      setSaveMsg(null);
      setReviewRows(null);
      setSummaryModal(null);
      setOcrBusy(true);
      try {
        const { imageBase64, mimeType } = await fileToBase64Payload(file);

        const res = await fetch(PARSE_ROUTE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, mimeType }),
        });

        const responseText = await res.text();
        let payload;
        try {
          payload = JSON.parse(responseText);
        } catch {
          setParseErr(
            res.ok
              ? "Invalid response from parser. Try again."
              : `Parse failed (${res.status}). ${responseText.slice(0, 280)}`
          );
          return;
        }

        if (!res.ok) {
          const msg =
            typeof payload?.error === "string"
              ? payload.error
              : `Parser error (${res.status})`;
          const extra =
            typeof payload?.detail === "string"
              ? ` ${payload.detail}`
              : typeof payload?.raw === "string"
                ? ` ${payload.raw.slice(0, 200)}`
                : "";
          setParseErr(`${msg}.${extra}`.trim());
          console.error("[route-sheet parse] API error", res.status, payload);
          return;
        }

        const parsed = normalizeParsedRows(payload);
        console.log("[route-sheet parse] rows from AI", parsed);

        setSoftHint(
          parsed.length === 0
            ? "Could not fully parse — please review and adjust."
            : null
        );

        const dbRows = await getPropertiesForTechnician(tech);
        const review = buildRouteSheetReviewRows(parsed, dbRows, tech);
        setReviewRows(review);
      } catch (e) {
        console.error(e);
        setParseErr(
          e instanceof Error && e.message
            ? e.message
            : "Could not read the image. Try again or use a smaller photo."
        );
      } finally {
        setOcrBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [tech]
  );

  const updateRow = useCallback((key, patch) => {
    setReviewRows((rows) =>
      (rows ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!reviewRows?.length || !tech) return;
    setSaveBusy(true);
    setSaveMsg(null);
    setSummaryModal(null);
    try {
      const dbRows = await getPropertiesForTechnician(tech);
      const taken = new Set(dbRows.map((r) => r.property_slug.toLowerCase()));
      const summary = await applyRouteSheetReviewRows(reviewRows, taken, dbRows);
      setReviewRows(null);
      setSoftHint(null);
      await refreshDbCount();
      onApplied?.();
      setSummaryModal(summary);
      if (summary.errors.length > 0) {
        setSaveMsg("Some rows could not be saved. See the summary.");
      }
    } catch (e) {
      console.error(e);
      setSaveMsg("Save failed. Check Supabase permissions and the console.");
    } finally {
      setSaveBusy(false);
    }
  }, [reviewRows, tech, refreshDbCount, onApplied]);

  const cancelReview = useCallback(() => {
    setReviewRows(null);
    setParseErr(null);
    setSoftHint(null);
    setSaveMsg(null);
  }, []);

  if (!tech) return null;

  const effectiveCount = Math.max(dbCount, routeCountHint);
  const uploadLabel =
    effectiveCount === 0
      ? "Upload picture of your sheet"
      : "Upload pic of sheet to update info";

  return (
    <section className={styles.wrap} aria-label="Route sheet photo">
      <RouteSheetSummaryModal summary={summaryModal} onClose={() => setSummaryModal(null)} />

      <h2 className={styles.title}>Route sheet</h2>
      <p className={styles.hint}>{uploadLabel}</p>
      <div className={styles.fileRow}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          disabled={ocrBusy || saveBusy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void runOcr(f);
          }}
        />
        <button
          type="button"
          className={styles.btn}
          disabled={ocrBusy || saveBusy}
          onClick={() => fileRef.current?.click()}
        >
          {ocrBusy ? "Analyzing sheet…" : "Choose photo"}
        </button>
      </div>
      {parseErr ? (
        <div className={styles.errBanner}>
          <p className={styles.err} role="alert">
            {parseErr}
          </p>
        </div>
      ) : null}
      {softHint ? <p className={styles.parseNotice}>{softHint}</p> : null}
      {saveMsg ? <p className={styles.feedback}>{saveMsg}</p> : null}

      {reviewRows !== null ? (
        <div className={styles.review}>
          {reviewRows.length === 0 ? (
            <p className={styles.parseNotice}>
              Could not fully parse — please review and adjust. Add rows manually if needed, upload another
              photo, or cancel.
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Route</th>
                  <th>Heat</th>
                  <th>Technician</th>
                  <th>Match</th>
                  <th>Action</th>
                  <th>Slug</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRow(r.key, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={r.address}
                        onChange={(e) => updateRow(r.key, { address: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={r.guestCheck}
                        onChange={(e) =>
                          updateRow(r.key, {
                            guestCheck: e.target.value === "check" ? "check" : "guest",
                          })
                        }
                      >
                        <option value="guest">guest</option>
                        <option value="check">check</option>
                      </select>
                    </td>
                    <td>
                      <label className={styles.statusMuted}>
                        <input
                          type="checkbox"
                          checked={r.heat}
                          onChange={(e) => updateRow(r.key, { heat: e.target.checked })}
                        />{" "}
                        heat
                      </label>
                    </td>
                    <td>
                      <span className={styles.statusMuted}>{r.technician_slug}</span>
                    </td>
                    <td>
                      <span className={styles.statusMuted}>{r.matchStatus}</span>
                    </td>
                    <td>
                      <span className={styles.statusMuted}>
                        {r.action === "update" ? "Update existing" : "Create new"}
                      </span>
                    </td>
                    <td>
                      {r.action === "create" ? (
                        <input
                          type="text"
                          value={r.property_slug}
                          onChange={(e) =>
                            updateRow(r.key, { property_slug: e.target.value.toLowerCase().trim() })
                          }
                        />
                      ) : (
                        <span className={styles.statusMuted}>{r.property_slug}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={saveBusy || reviewRows.length === 0}
              onClick={() => void handleSave()}
            >
              {saveBusy ? "Saving…" : "Confirm & save to route"}
            </button>
            <button type="button" className={styles.btnGhost} disabled={saveBusy} onClick={cancelReview}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
