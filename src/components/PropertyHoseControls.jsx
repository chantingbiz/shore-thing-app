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
  parseSpaFillDigitsToMinutes,
  spaFillDigitsToDisplay,
  spaFillMinutesToDisplay,
  spaFillMinutesToDigits,
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

  const [spaFillDigits, setSpaFillDigits] = useState("");
  const [spaFillFocused, setSpaFillFocused] = useState(false);
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
    const nextDigits = spaFillMinutesToDigits(spaFillMinutes);
    setSpaFillDigits(nextDigits);
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
    const minutes = spaFillDigits ? parseSpaFillDigitsToMinutes(spaFillDigits) : 0;
    if (spaFillDigits && minutes === null) {
      setSpaFillError("Enter digits only. Examples: 45 → 0:45, 125 → 1:25.");
      return;
    }
    setSpaFillError("");
    setSpaFillSaving(true);
    try {
      const row = await updateProperty(pid, { spa_fill_minutes: minutes });
      if (row && typeof onPropertySpaFillUpdated === "function") {
        onPropertySpaFillUpdated(row);
      }
      const saved = row?.spa_fill_minutes ?? minutes;
      setSpaFillDigits(spaFillMinutesToDigits(saved));
    } catch (e) {
      setSpaFillError(e?.message ? String(e.message) : "Could not save.");
    } finally {
      setSpaFillSaving(false);
    }
  };

  const spaFillDisplay = spaFillDigitsToDisplay(spaFillDigits);
  const spaFillValue = spaFillFocused ? spaFillDisplay : spaFillDisplay || "0:00";

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
          <div className={styles.spaFillRef}>
            <label className={styles.spaFillLabel} htmlFor={`spa-fill-${propertySlug}`}>
              Typical Spa Fill Time
            </label>
            <div className={styles.spaFillRow}>
              <input
                id={`spa-fill-${propertySlug}`}
                className={styles.spaFillInput}
                type="tel"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="off"
                placeholder="0:00"
                value={spaFillValue}
                onChange={(e) => {
                  const digits = String(e.target.value ?? "")
                    .replace(/\D/g, "")
                    .slice(0, 3);
                  setSpaFillDigits(digits);
                  setSpaFillError("");
                }}
                onFocus={(e) => {
                  setSpaFillFocused(true);
                  // On mobile, focusing doesn't always select; defer to next tick.
                  window.setTimeout(() => {
                    try {
                      e.target.select?.();
                    } catch {
                      // ignore
                    }
                  }, 0);
                }}
                onBlur={() => setSpaFillFocused(false)}
                aria-invalid={Boolean(spaFillError)}
                aria-describedby={
                  spaFillError
                    ? `spa-fill-hint-${propertySlug} spa-fill-err-${propertySlug}`
                    : `spa-fill-hint-${propertySlug}`
                }
              />
              <button
                type="button"
                className={styles.spaFillSave}
                disabled={spaFillSaving}
                onClick={() => void handleSaveSpaFill()}
              >
                {spaFillSaving ? "Saving…" : "Save"}
              </button>
            </div>
            <p id={`spa-fill-hint-${propertySlug}`} className={styles.spaFillHint}>
              Type digits only (auto-formats to H:MM).
            </p>
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
