import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RouteSheetUploadPanel from "../../components/RouteSheetUploadPanel.jsx";
import { getPropertiesForTechnician } from "../../lib/api.js";
import { mergeStephenRouteListWithDb } from "../../utils/mergeTechnicianRouteList.js";
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
import PropertyInlineNameEdit from "../../components/PropertyInlineNameEdit.jsx";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import glass from "../../styles/glassButtons.module.css";
import {
  ensurePropertiesBySlug,
  ensureRouteSettings,
  primePropertiesBySlug,
  primeTechnicianToday,
  resolveDbPropertyId,
} from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { flushPendingWorkNow } from "../../utils/workFlushRegistry.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./StephenPropertiesPage.module.css";

const TECH_SLUG = "stephen";

export default function StephenPropertiesPage() {
  useSupabaseSyncTick();
  const [now, setNow] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);
  const [dbProps, setDbProps] = useState([]);

  const loadDbProps = useCallback(async () => {
    try {
      const rows = await getPropertiesForTechnician(TECH_SLUG);
      setDbProps(rows);
    } catch (e) {
      console.error(e);
      setDbProps([]);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadDbProps();
  }, [loadDbProps]);

  const displayList = useMemo(() => mergeStephenRouteListWithDb(dbProps), [dbProps]);

  useEffect(() => {
    const slugs = displayList.map((p) => p.slug);
    primePropertiesBySlug(slugs);
    primeTechnicianToday(TECH_SLUG, []);
    void ensurePropertiesBySlug(slugs).then(() => {
      const ids = slugs.map((s) => resolveDbPropertyId(s)).filter(Boolean);
      if (ids.length) void ensureRouteSettings(ids);
    });
  }, [displayList]);

  const sorted = useMemo(() => {
    void refreshTick;
    return sortPropertiesForTechnicianList(displayList, TECH_SLUG);
  }, [displayList, refreshTick]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
    setNow(Date.now());
  }, []);

  const toggleCompleted = useCallback((p, e) => {
    e.preventDefault();
    e.stopPropagation();
    flushPendingWorkNow();
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
      <RouteSheetUploadPanel
        technicianSlug={TECH_SLUG}
        routeCountHint={displayList.length}
        onApplied={() => {
          void loadDbProps();
          setRefreshTick((n) => n + 1);
        }}
      />
      <nav className={styles.list} aria-label="Stephen properties">
        {sorted.map((p) => {
          const poolTs = getPoolStart(TECH_SLUG, p.slug);
          const spaTs = getSpaStart(TECH_SLUG, p.slug);
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
                  <div className={styles.cardNameRow}>
                    <span className={styles.cardName}>{p.name}</span>
                    <PropertyInlineNameEdit
                      propertyId={p.id}
                      name={p.name}
                      onUpdated={() => void loadDbProps()}
                    />
                  </div>
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
