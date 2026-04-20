import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../../data/technicians.js";
import { formatTechnicianSlugForDisplay } from "../../utils/technicianDisplay.js";
import {
  formatActivityTime,
  getFirstActivityTimestampToday,
  getGroupedDisplayEvents,
  getPropertiesTouchedToday,
  getTechnicianEventsToday,
} from "../../utils/activityLog.js";
import { getAdminPropertyDayStatus } from "../../utils/technicianPropertyStatus.js";
import {
  getActiveRouteSheetSaturdayEastern,
  getOperationalRouteSheetTypeForToday,
} from "../../lib/routeSheetWeek.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import detailStyles from "./AdminActivityDetailPage.module.css";
import { primeTechnicianToday } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { fetchRouteSheetSentGuestCheckSummary } from "../../utils/routeSheetSentGuestCheckSummary.js";

export default function AdminActivityDetailPage() {
  const { techSlug } = useParams();
  const techSlugLower = String(techSlug ?? "").toLowerCase();
  useSupabaseSyncTick();
  const [poll, setPoll] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sheetPair, setSheetPair] = useState({
    turnover: /** @type {Awaited<ReturnType<typeof fetchRouteSheetSentGuestCheckSummary>> | null} */ (
      null
    ),
    midweek: /** @type {Awaited<ReturnType<typeof fetchRouteSheetSentGuestCheckSummary>> | null} */ (
      null
    ),
  });

  useEffect(() => {
    const id = window.setInterval(() => setPoll((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (techSlugLower !== "stephen") return;
    primeTechnicianToday("stephen", []);
  }, [techSlugLower]);

  useEffect(() => {
    if (techSlugLower !== "stephen") return;
    let cancelled = false;
    const week = getActiveRouteSheetSaturdayEastern();
    void (async () => {
      const [turnover, midweek] = await Promise.all([
        fetchRouteSheetSentGuestCheckSummary("stephen", "turnover", { weekStartDate: week }),
        fetchRouteSheetSentGuestCheckSummary("stephen", "midweek", { weekStartDate: week }),
      ]);
      if (!cancelled) setSheetPair({ turnover, midweek });
    })();
    return () => {
      cancelled = true;
    };
  }, [techSlugLower, refreshTick, poll]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  const tech = getTechnicianBySlug(techSlug);

  if (!tech) {
    return <Navigate to="/administrator/activity" replace />;
  }

  const techLabel = tech.name ?? formatTechnicianSlugForDisplay(tech.slug);

  if (tech.slug !== "stephen") {
    return (
      <SubpageTemplate
        title={techLabel}
        backTo="/administrator/activity"
        readableDarkText
      >
        <p className={styles.placeholderNote}>
          Activity detail for {techLabel} is not available yet. No activity data is recorded for
          this technician in this version.
        </p>
      </SubpageTemplate>
    );
  }

  void refreshTick;
  const operationalType = useMemo(() => getOperationalRouteSheetTypeForToday(), [poll, refreshTick]);
  const firstAt = getFirstActivityTimestampToday("stephen");
  const properties = getPropertiesTouchedToday("stephen");
  const rawEvents = getTechnicianEventsToday("stephen");
  const groupedEvents = getGroupedDisplayEvents(rawEvents);
  const to = sheetPair.turnover;
  const mw = sheetPair.midweek;
  const showRouteStats =
    operationalType === "turnover"
      ? !!to && (to.guestTotal ?? 0) + (to.checkTotal ?? 0) > 0
      : !!mw && (mw.guestTotal ?? 0) > 0;

  return (
    <SubpageTemplate
      title={techLabel}
      backTo="/administrator/activity"
      readableDarkText
    >
      <div className={styles.toolbar}>
        <p className={detailStyles.summary} style={{ margin: 0, flex: 1 }}>
          {firstAt != null ? (
            <>
              First activity today: <strong>{formatActivityTime(firstAt)}</strong>
            </>
          ) : (
            <>No activity logged today.</>
          )}
        </p>
        <button type="button" className={styles.refreshBtn} onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {showRouteStats && operationalType === "turnover" && to ? (
        <div
          className={styles.routeDayStats}
          aria-label="Turnover route sheet (today)"
        >
          <p className={styles.routeStatPill}>
            {to.guestCompleted}/{to.guestTotal} guests completed
          </p>
          <p className={styles.routeStatPill}>
            {(to.guestInProgress ?? 0)}/{(to.guestTotal ?? 0)} guests in progress
          </p>
          <p className={styles.routeStatPill}>
            {to.checkCompleted}/{to.checkTotal} checks completed
          </p>
          <p className={styles.routeStatPill}>
            {(to.checkInProgress ?? 0)}/{(to.checkTotal ?? 0)} checks in progress
          </p>
        </div>
      ) : showRouteStats && operationalType === "midweek" && mw ? (
        <div
          className={styles.routeDayStats}
          aria-label="Midweek route sheet (today)"
        >
          <p className={styles.routeStatPill}>
            {mw.guestCompleted}/{mw.guestTotal} guests completed
          </p>
          <p className={styles.routeStatPill}>
            {(mw.guestInProgress ?? 0)}/{(mw.guestTotal ?? 0)} guests in progress
          </p>
        </div>
      ) : null}

      {properties.length === 0 ? (
        <p className={styles.placeholderNote}>No properties visited yet today.</p>
      ) : (
        <>
          <h2 className={detailStyles.sectionHeading}>Properties today</h2>
          <nav className={styles.list} aria-label="Properties with activity">
            {properties.map((p) => {
              const status = getAdminPropertyDayStatus("stephen", p.propertySlug);
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
                    <span className={styles.statusBadgeCompleted}>Completed</span>
                  ) : (
                    <span className={styles.statusBadgeInProgress}>In progress</span>
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
                <span className={detailStyles.eventTime}>{formatActivityTime(ev.t)}</span>
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
