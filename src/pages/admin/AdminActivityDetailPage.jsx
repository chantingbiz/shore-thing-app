import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug, getTechnicianRouteProperties } from "../../data/technicians.js";
import {
  formatActivityTime,
  getFirstActivityTimestampToday,
  getGroupedDisplayEvents,
  getPropertiesTouchedToday,
  getTechnicianEventsToday,
} from "../../utils/activityLog.js";
import {
  getAdminPropertyDayStatus,
  getTechnicianRouteDaySummaryByPropertyId,
} from "../../utils/technicianPropertyStatus.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import detailStyles from "./AdminActivityDetailPage.module.css";
import { primeTechnicianToday } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";

export default function AdminActivityDetailPage() {
  const { techSlug } = useParams();
  useSupabaseSyncTick();
  const [, setPoll] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPoll((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  const tech = getTechnicianBySlug(techSlug);

  if (!tech) {
    return <Navigate to="/administrator/activity" replace />;
  }

  if (tech.slug !== "stephen") {
    return (
      <SubpageTemplate
        title={tech.name}
        backTo="/administrator/activity"
        readableDarkText
      >
        <p className={styles.placeholderNote}>
          Activity detail for {tech.name} is not available yet. No activity
          data is recorded for this technician in this version.
        </p>
      </SubpageTemplate>
    );
  }

  primeTechnicianToday("stephen", []);
  void refreshTick;
  const firstAt = getFirstActivityTimestampToday("stephen");
  const properties = getPropertiesTouchedToday("stephen");
  const rawEvents = getTechnicianEventsToday("stephen");
  const groupedEvents = getGroupedDisplayEvents(rawEvents);
  const { total, completedCount, inProgressCount } = getTechnicianRouteDaySummaryByPropertyId(
    tech.slug,
    getTechnicianRouteProperties(tech.slug)
  );

  return (
    <SubpageTemplate
      title={tech.name}
      backTo="/administrator/activity"
      readableDarkText
    >
      <div className={styles.toolbar}>
        <p className={detailStyles.summary} style={{ margin: 0, flex: 1 }}>
          {firstAt != null ? (
            <>
              First activity today:{" "}
              <strong>{formatActivityTime(firstAt)}</strong>
            </>
          ) : (
            <>No activity logged today.</>
          )}
        </p>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>

      <div
        className={styles.routeDayStats}
        aria-label="Route completion summary for today"
      >
        <p className={styles.routeStatPill}>
          {completedCount}/{total} completed
        </p>
        <p className={styles.routeStatPill}>
          {inProgressCount} in progress
        </p>
      </div>

      {properties.length === 0 ? (
        <p className={styles.placeholderNote}>
          No properties visited yet today.
        </p>
      ) : (
        <>
          <h2 className={detailStyles.sectionHeading}>Properties today</h2>
          <nav className={styles.list} aria-label="Properties with activity">
            {properties.map((p) => {
              const status = getAdminPropertyDayStatus(
                "stephen",
                p.propertySlug
              );
              return (
                <Link
                  key={p.propertySlug}
                  to={`/administrator/activity/stephen/${p.propertySlug}`}
                  className={styles.cardLink}
                >
                  <p className={styles.cardTitle}>{p.propertyName}</p>
                  <p className={styles.cardMeta}>
                    Last: {formatActivityTime(p.lastT)} · {p.summary}
                  </p>
                  {status === "completed" ? (
                    <span className={styles.statusBadgeCompleted}>
                      Completed
                    </span>
                  ) : (
                    <span className={styles.statusBadgeInProgress}>
                      In progress
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </>
      )}

      {groupedEvents.length > 0 ? (
        <>
          <h2 className={detailStyles.sectionHeading}>Recent events</h2>
          <ul className={detailStyles.eventList}>
            {groupedEvents.slice(0, 40).map((ev, i) => (
              <li
                key={`${ev.t}-${ev.propertySlug}-${ev.type}-${i}`}
                className={detailStyles.eventItem}
              >
                <span className={detailStyles.eventTime}>
                  {formatActivityTime(ev.t)}
                </span>
                <span className={detailStyles.eventBody}>
                  {ev.propertyName} — {ev.displayLabel}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </SubpageTemplate>
  );
}
