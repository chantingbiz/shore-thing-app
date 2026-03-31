import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { STEPHEN_PROPERTIES } from "../../data/stephenProperties.js";
import {
  elapsedSecondsSince,
  formatHoseElapsed,
  getPoolStart,
  getSpaStart,
} from "../../utils/hoseTimers.js";
import { logTechnicianActivity } from "../../utils/activityLog.js";
import {
  isPropertyCompletedToday,
  setPropertyCompletedForDay,
} from "../../utils/propertyCompletion.js";
import { sortPropertiesForTechnicianList } from "../../utils/technicianPropertyOrder.js";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./StephenPropertiesPage.module.css";

const TECH_SLUG = "stephen";

export default function StephenPropertiesPage() {
  const [now, setNow] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (
        e.key &&
        (e.key.startsWith("hose_pool_") ||
          e.key.startsWith("hose_spa_") ||
          e.key === "shore_activity_log_v1" ||
          e.key === "shore_property_completion_v1")
      ) {
        setRefreshTick((n) => n + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const sorted = useMemo(() => {
    void refreshTick;
    return sortPropertiesForTechnicianList(STEPHEN_PROPERTIES, TECH_SLUG);
  }, [refreshTick]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
    setNow(Date.now());
  }, []);

  const toggleCompleted = useCallback((p, e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isPropertyCompletedToday(TECH_SLUG, p.slug);
    setPropertyCompletedForDay(TECH_SLUG, p.slug, next);
    if (next) {
      logTechnicianActivity(TECH_SLUG, {
        propertySlug: p.slug,
        propertyName: p.name,
        type: "property_completed",
        label: "Completed property",
      });
    }
    setRefreshTick((n) => n + 1);
  }, []);

  return (
    <SubpageTemplate title="Stephen" backTo="/technicians">
      <div className={styles.toolbar}>
        <p className={styles.intro}>Select a property</p>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>
      <nav className={styles.list} aria-label="Stephen properties">
        {sorted.map((p) => {
          const poolTs = getPoolStart(p.slug);
          const spaTs = getSpaStart(p.slug);
          const poolSec =
            poolTs != null ? elapsedSecondsSince(poolTs, now) : null;
          const spaSec =
            spaTs != null ? elapsedSecondsSince(spaTs, now) : null;
          const hasActive = poolSec != null || spaSec != null;
          const completed = isPropertyCompletedToday(TECH_SLUG, p.slug);

          return (
            <div
              key={p.slug}
              className={`${styles.cardShell} ${completed ? styles.cardShellCompleted : ""}`}
            >
              <Link
                to={`/technician/stephen/${p.slug}`}
                className={styles.cardHitArea}
                aria-label={`Open ${p.name}`}
              />
              <div className={styles.cardInner}>
                <div className={styles.cardTop}>
                  <span className={styles.cardName}>{p.name}</span>
                  <div className={styles.cardTopRight}>
                    {hasActive ? (
                      <span className={styles.liveBadge} aria-hidden>
                        Live
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`${glass.glassBtn} ${styles.jobGlassBtn}`}
                      aria-label={
                        completed
                          ? "Reopen job — mark property not completed for today"
                          : "Finish job — mark property completed for today"
                      }
                      onClick={(e) => toggleCompleted(p, e)}
                    >
                      <span
                        className={`${glass.btnLabel} ${styles.jobGlassBtnLabel}`}
                      >
                        {completed ? "Reopen Job" : "Finish Job"}
                      </span>
                    </button>
                  </div>
                </div>
                <RouteParamBadges
                  propertySlug={p.slug}
                  className={styles.routeBadges}
                />
                <span className={styles.cardAddress}>{p.address}</span>
                <p className={styles.statusLine} role="status">
                  <span
                    className={
                      completed
                        ? `${styles.statusBadge} ${styles.statusBadgeCompleted}`
                        : `${styles.statusBadge} ${styles.statusBadgeNotDone}`
                    }
                  >
                    {completed ? "Completed" : "Not completed"}
                  </span>
                </p>
                {hasActive ? (
                  <div className={styles.timersRow} aria-label="Active hose timers">
                    {poolSec != null ? (
                      <div className={styles.timerPill}>
                        <span className={styles.timerPillLabel}>Pool</span>
                        <span className={styles.timerPillValue}>
                          {formatHoseElapsed(poolSec)}
                        </span>
                      </div>
                    ) : null}
                    {spaSec != null ? (
                      <div className={styles.timerPill}>
                        <span className={styles.timerPillLabel}>Spa</span>
                        <span className={styles.timerPillValue}>
                          {formatHoseElapsed(spaSec)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </nav>
    </SubpageTemplate>
  );
}
