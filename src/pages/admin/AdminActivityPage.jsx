import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TECHNICIANS,
  getTechnicianRouteProperties,
} from "../../data/technicians.js";
import {
  formatActivityTime,
  getFirstActivityTimestampToday,
} from "../../utils/activityLog.js";
import { getTechnicianRouteDaySummary } from "../../utils/technicianPropertyStatus.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import { primeTechnicianToday } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";

export default function AdminActivityPage() {
  useSupabaseSyncTick();
  const [, setPoll] = useState(0);
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
          const routeProps = getTechnicianRouteProperties(t.slug);
          const { total, completedCount, inProgressCount } =
            getTechnicianRouteDaySummary(t.slug, routeProps);
          const showRouteStats = total > 0;
          return (
            <Link
              key={t.slug}
              to={`/administrator/activity/${t.slug}`}
              className={styles.cardLink}
            >
              <p className={styles.cardTitle}>{t.name}</p>
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
              {showRouteStats ? (
                <div
                  className={styles.cardRouteStats}
                  aria-label={`Route summary for ${t.name}`}
                >
                  <p className={styles.routeStatPill}>
                    {completedCount}/{total} completed
                  </p>
                  <p className={styles.routeStatPill}>
                    {inProgressCount} in progress
                  </p>
                </div>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </SubpageTemplate>
  );
}
