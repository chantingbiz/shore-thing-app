import { useEffect, useRef, useState } from "react";
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
import { patchHoseFlagsOnSnapshot } from "../utils/technicianWorkSnapshot.js";
import styles from "./PropertyHoseControls.module.css";

export default function PropertyHoseControls({
  propertySlug,
  propertyId,
  technicianSlug,
  propertyName,
  enableActivityLog = false,
}) {
  const [now, setNow] = useState(() => Date.now());
  const poolStartRef = useRef(null);
  const spaStartRef = useRef(null);
  const [poolActive, setPoolActive] = useState(false);
  const [spaActive, setSpaActive] = useState(false);

  useEffect(() => {
    const poolTs = getPoolStart(technicianSlug, propertyId);
    const spaTs = getSpaStart(technicianSlug, propertyId);
    poolStartRef.current = poolTs;
    spaStartRef.current = spaTs;
    setPoolActive(poolTs != null);
    setSpaActive(spaTs != null);
  }, [propertySlug, propertyId, technicianSlug]);

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
      logHose("pool_hose_stopped", "Pool hose removed");
      clearPool(technicianSlug, propertyId);
      poolStartRef.current = null;
      setPoolActive(false);
    } else {
      logHose("pool_hose_started", "Pool hose started");
      const ts = Date.now();
      setPoolStart(technicianSlug, propertyId, ts);
      poolStartRef.current = ts;
      setPoolActive(true);
    }
    syncSnapshotHose();
    setNow(Date.now());
  };

  const toggleSpa = () => {
    if (spaActive) {
      logHose("spa_hose_stopped", "Spa hose removed");
      clearSpa(technicianSlug, propertyId);
      spaStartRef.current = null;
      setSpaActive(false);
    } else {
      logHose("spa_hose_started", "Spa hose started");
      const ts = Date.now();
      setSpaStart(technicianSlug, propertyId, ts);
      spaStartRef.current = ts;
      setSpaActive(true);
    }
    syncSnapshotHose();
    setNow(Date.now());
  };

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
      </div>
    </section>
  );
}
