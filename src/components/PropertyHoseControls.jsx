import { useEffect, useRef, useState } from "react";
import { updateProperty } from "../lib/api.js";
import glass from "../styles/glassButtons.module.css";
import {
  clearPool,
  clearSpa,
  elapsedSecondsSince,
  formatHoseElapsed,
  getPoolStart,
  getSpaStart,
  setPoolStart,
  setSpaStart,
} from "../utils/hoseTimers.js";
import { logTechnicianActivity } from "../utils/activityLog.js";
import {
  SPA_FILL_HOUR_OPTIONS,
  SPA_FILL_MINUTE_STEP_OPTIONS,
  dropdownValuesToTotalMinutes,
  formatSpaFillTargetPreview,
  totalMinutesToDropdownValues,
} from "../utils/spaFillMinutesFormat.js";
import { patchHoseFlagsOnSnapshot } from "../utils/technicianWorkSnapshot.js";
import styles from "./PropertyHoseControls.module.css";

export default function PropertyHoseControls({
  propertySlug,
  technicianSlug,
  propertyName,
  enableActivityLog = false,
  /** When set, shows editable typical spa fill time (property-level, not service_logs). */
  propertyId = "",
  spaFillMinutes = undefined,
  /** Called after a successful save with the updated property row (or partial). */
  onPropertySpaFillUpdated = undefined,
}) {
  const [now, setNow] = useState(() => Date.now());
  const poolStartRef = useRef(null);
  const spaStartRef = useRef(null);
  const [poolActive, setPoolActive] = useState(false);
  const [spaActive, setSpaActive] = useState(false);

  const [spaFillHours, setSpaFillHours] = useState(0);
  const [spaFillMinuteStep, setSpaFillMinuteStep] = useState(0);
  const [spaFillError, setSpaFillError] = useState("");
  const [spaFillSaving, setSpaFillSaving] = useState(false);

  useEffect(() => {
    const poolTs = getPoolStart(technicianSlug, propertySlug);
    const spaTs = getSpaStart(technicianSlug, propertySlug);
    poolStartRef.current = poolTs;
    spaStartRef.current = spaTs;
    setPoolActive(poolTs != null);
    setSpaActive(spaTs != null);
  }, [propertySlug, technicianSlug]);

  useEffect(() => {
    const { hours, minutes } = totalMinutesToDropdownValues(spaFillMinutes);
    setSpaFillHours(hours);
    setSpaFillMinuteStep(minutes);
    setSpaFillError("");
  }, [propertyId, spaFillMinutes]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const poolElapsed =
    poolActive && poolStartRef.current != null
      ? elapsedSecondsSince(poolStartRef.current, now)
      : 0;
  const spaElapsed =
    spaActive && spaStartRef.current != null
      ? elapsedSecondsSince(spaStartRef.current, now)
      : 0;

  const logHose = (type, label) => {
    if (!enableActivityLog || !technicianSlug || !propertyName) return;
    logTechnicianActivity(technicianSlug, {
      propertySlug,
      propertyName,
      type,
      label,
    });
  };

  const syncSnapshotHose = () => {
    if (technicianSlug) {
      patchHoseFlagsOnSnapshot(technicianSlug, propertySlug);
    }
  };

  const togglePool = () => {
    if (poolActive) {
      logHose("pool_hose_stopped", "Removed pool hose");
      clearPool(technicianSlug, propertySlug);
      poolStartRef.current = null;
      setPoolActive(false);
    } else {
      logHose("pool_hose_started", "Dropped pool hose");
      const ts = Date.now();
      setPoolStart(technicianSlug, propertySlug, ts);
      poolStartRef.current = ts;
      setPoolActive(true);
    }
    syncSnapshotHose();
    setNow(Date.now());
  };

  const toggleSpa = () => {
    if (spaActive) {
      logHose("spa_hose_stopped", "Removed spa hose");
      clearSpa(technicianSlug, propertySlug);
      spaStartRef.current = null;
      setSpaActive(false);
    } else {
      logHose("spa_hose_started", "Dropped spa hose");
      const ts = Date.now();
      setSpaStart(technicianSlug, propertySlug, ts);
      spaStartRef.current = ts;
      setSpaActive(true);
    }
    syncSnapshotHose();
    setNow(Date.now());
  };

  const handleSaveSpaFill = async () => {
    const pid = String(propertyId ?? "").trim();
    if (!pid) return;
    const minutes = dropdownValuesToTotalMinutes(spaFillHours, spaFillMinuteStep);
    setSpaFillError("");
    setSpaFillSaving(true);
    try {
      const row = await updateProperty(pid, { spa_fill_minutes: minutes });
      if (row && typeof onPropertySpaFillUpdated === "function") {
        onPropertySpaFillUpdated(row);
      }
      const saved = row?.spa_fill_minutes ?? minutes;
      const next = totalMinutesToDropdownValues(saved);
      setSpaFillHours(next.hours);
      setSpaFillMinuteStep(next.minutes);
    } catch (e) {
      setSpaFillError(e?.message ? String(e.message) : "Could not save.");
    } finally {
      setSpaFillSaving(false);
    }
  };

  const spaFillTotalUi = dropdownValuesToTotalMinutes(spaFillHours, spaFillMinuteStep);
  const spaFillTargetLine = formatSpaFillTargetPreview(spaFillTotalUi);
  const spaFillGroupId = `spa-fill-group-${propertySlug}`;

  return (
    <section className={styles.wrap} aria-label="Hose controls">
      <div className={styles.block}>
        <button
          type="button"
          className={`${glass.glassBtn} ${glass.glassBtnFull} ${styles.hoseBtn}`}
          onClick={togglePool}
        >
          <span className={glass.btnLabel}>
            {poolActive ? "Remove Hose (Pool)" : "Drop Hose (Pool)"}
          </span>
        </button>
        {poolActive ? (
          <p
            className={`${styles.timer} ${styles.timerLive}`}
            aria-live="polite"
          >
            {formatHoseElapsed(poolElapsed)}
          </p>
        ) : null}
      </div>
      <div className={styles.block}>
        <button
          type="button"
          className={`${glass.glassBtn} ${glass.glassBtnFull} ${styles.hoseBtn}`}
          onClick={toggleSpa}
        >
          <span className={glass.btnLabel}>
            {spaActive ? "Remove Hose (Spa)" : "Drop Hose (Spa)"}
          </span>
        </button>
        {spaActive ? (
          <p
            className={`${styles.timer} ${styles.timerLive}`}
            aria-live="polite"
          >
            {formatHoseElapsed(spaElapsed)}
          </p>
        ) : null}
        {String(propertyId ?? "").trim() ? (
          <div
            className={styles.spaFillRef}
            role="group"
            aria-labelledby={spaFillGroupId}
          >
            <div id={spaFillGroupId} className={styles.spaFillLabel}>
              Typical Spa Fill Time
            </div>
            <p className={styles.spaFillTarget} aria-live="polite">
              {spaFillTargetLine}
            </p>
            <div className={styles.spaFillRow}>
              <div className={styles.spaFillSelectCol}>
                <label
                  className={styles.spaFillSubLabel}
                  htmlFor={`spa-fill-hours-${propertySlug}`}
                >
                  Hours
                </label>
                <select
                  id={`spa-fill-hours-${propertySlug}`}
                  className={styles.spaFillSelect}
                  value={spaFillHours}
                  onChange={(e) => {
                    setSpaFillHours(Number(e.target.value));
                    setSpaFillError("");
                  }}
                  aria-invalid={Boolean(spaFillError)}
                  aria-describedby={
                    spaFillError ? `spa-fill-err-${propertySlug}` : undefined
                  }
                >
                  {SPA_FILL_HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.spaFillSelectCol}>
                <label
                  className={styles.spaFillSubLabel}
                  htmlFor={`spa-fill-min-${propertySlug}`}
                >
                  Minutes
                </label>
                <select
                  id={`spa-fill-min-${propertySlug}`}
                  className={styles.spaFillSelect}
                  value={spaFillMinuteStep}
                  onChange={(e) => {
                    setSpaFillMinuteStep(Number(e.target.value));
                    setSpaFillError("");
                  }}
                  aria-invalid={Boolean(spaFillError)}
                  aria-describedby={
                    spaFillError ? `spa-fill-err-${propertySlug}` : undefined
                  }
                >
                  {SPA_FILL_MINUTE_STEP_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.spaFillSaveWrap}>
                <span
                  className={`${styles.spaFillSubLabel} ${styles.spaFillSubLabelGhost}`}
                  aria-hidden
                >
                  Save
                </span>
                <button
                  type="button"
                  className={styles.spaFillSave}
                  disabled={spaFillSaving}
                  onClick={() => void handleSaveSpaFill()}
                >
                  {spaFillSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            {spaFillError ? (
              <p id={`spa-fill-err-${propertySlug}`} className={styles.spaFillErr} role="alert">
                {spaFillError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
