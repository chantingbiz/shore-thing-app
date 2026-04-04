import { useCallback, useEffect, useRef, useState } from "react";
import { getPropertiesForTechnician } from "../lib/api.js";
import { applyRouteSheetReviewRows } from "../utils/routeSheetApply.js";
import { buildRouteSheetReviewRows } from "../utils/routeSheetMatch.js";
import { parseRouteSheetText } from "../utils/routeSheetParser.js";
import RouteSheetSummaryModal from "./RouteSheetSummaryModal.jsx";
import styles from "./RouteSheetUploadPanel.module.css";

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
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const {
          data: { text },
        } = await worker.recognize(file);
        await worker.terminate();

        const parsed = parseRouteSheetText(text);
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
        setParseErr("Could not read the image. Try again or use a smaller photo.");
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
          {ocrBusy ? "Reading sheet…" : "Choose photo"}
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
