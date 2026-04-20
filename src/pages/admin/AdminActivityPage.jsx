import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TECHNICIANS,
  getTechnicianBySlug,
  getTechnicianRouteProperties,
} from "../../data/technicians.js";
import { formatTechnicianSlugForDisplay } from "../../utils/technicianDisplay.js";
import {
  formatActivityTime,
  getFirstActivityTimestampToday,
  getPropertiesTouchedToday,
} from "../../utils/activityLog.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import { primeTechnicianToday } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { getAdminPropertyDayStatus } from "../../utils/technicianPropertyStatus.js";

export default function AdminActivityPage() {
  useSupabaseSyncTick();
  const [poll, setPoll] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPoll((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    for (const t of TECHNICIANS) {
      const routeProps = getTechnicianRouteProperties(t.slug);
      primeTechnicianToday(
        t.slug,
        routeProps.map((p) => p.id).filter(Boolean)
      );
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  return (
    <SubpageTemplate
      title="Today's Activity"
      backTo="/administrator"
      readableDarkText
    >
      <div className={styles.toolbar}>
        <p className={styles.intro}>Technician status for today</p>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>
      <nav className={styles.list} aria-label="Technicians">
        {TECHNICIANS.map((t) => {
          void refreshTick;
          const first = getFirstActivityTimestampToday(t.slug);
          const touched = getPropertiesTouchedToday(t.slug);
          const hasActivityToday = first != null || touched.length > 0;

          let completedCount = 0;
          let inProgressCount = 0;
          if (hasActivityToday) {
            for (const p of touched) {
              const st = getAdminPropertyDayStatus(t.slug, p.propertySlug);
              if (st === "completed") completedCount++;
              else if (st === "in_progress") inProgressCount++;
            }
          }

          const techLabel =
            getTechnicianBySlug(t.slug)?.name ?? formatTechnicianSlugForDisplay(t.slug);
          return (
            <Link
              key={t.slug}
              to={`/administrator/activity/${t.slug}`}
              className={styles.cardLink}
            >
              <p className={styles.cardTitle}>{techLabel}</p>
              <p
                className={
                  first != null
                    ? `${styles.cardMeta} ${styles.cardMetaStarted}`
                    : styles.cardMeta
                }
              >
                {first != null
                  ? `Started ${formatActivityTime(first)}`
                  : "No activity"}
              </p>
              {hasActivityToday ? (
                <div
                  className={styles.cardRouteStats}
                  aria-label={`Today's progress for ${techLabel}`}
                >
                  <p className={styles.routeStatPill}>Completed: {completedCount}</p>
                  <p className={styles.routeStatPill}>In progress: {inProgressCount}</p>
                </div>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </SubpageTemplate>
  );
}
