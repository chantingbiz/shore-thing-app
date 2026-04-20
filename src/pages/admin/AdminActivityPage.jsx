import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "../../utils/activityLog.js";
import {
  getActiveRouteSheetSaturdayEastern,
  getOperationalRouteSheetTypeForToday,
} from "../../lib/routeSheetWeek.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import { primeTechnicianToday } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { fetchRouteSheetSentGuestCheckSummary } from "../../utils/routeSheetSentGuestCheckSummary.js";

export default function AdminActivityPage() {
  useSupabaseSyncTick();
  const [poll, setPoll] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sheetByTech, setSheetByTech] = useState(
    /** @type {Record<string, { turnover: Awaited<ReturnType<typeof fetchRouteSheetSentGuestCheckSummary>>, midweek: Awaited<ReturnType<typeof fetchRouteSheetSentGuestCheckSummary>> } | undefined>} */
    {}
  );

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

  useEffect(() => {
    let cancelled = false;
    const week = getActiveRouteSheetSaturdayEastern();
    void (async () => {
      const next = {};
      await Promise.all(
        TECHNICIANS.map(async (t) => {
          const slug = t.slug;
          const [turnover, midweek] = await Promise.all([
            fetchRouteSheetSentGuestCheckSummary(slug, "turnover", { weekStartDate: week }),
            fetchRouteSheetSentGuestCheckSummary(slug, "midweek", { weekStartDate: week }),
          ]);
          next[slug] = { turnover, midweek };
        })
      );
      if (!cancelled) setSheetByTech(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, poll]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  const operationalType = useMemo(() => getOperationalRouteSheetTypeForToday(), [poll, refreshTick]);

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
          const pair = sheetByTech[t.slug];
          const to = pair?.turnover;
          const mw = pair?.midweek;
          const techLabel =
            getTechnicianBySlug(t.slug)?.name ?? formatTechnicianSlugForDisplay(t.slug);
          const showRouteStats =
            operationalType === "turnover"
              ? !!to && (to.guestTotal ?? 0) + (to.checkTotal ?? 0) > 0
              : !!mw && (mw.guestTotal ?? 0) > 0;
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
              {showRouteStats && operationalType === "turnover" && to ? (
                <div
                  className={styles.cardRouteStats}
                  aria-label={`Turnover route sheet for ${techLabel} (today)`}
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
                  className={styles.cardRouteStats}
                  aria-label={`Midweek route sheet for ${techLabel} (today)`}
                >
                  <p className={styles.routeStatPill}>
                    {mw.guestCompleted}/{mw.guestTotal} guests completed
                  </p>
                  <p className={styles.routeStatPill}>
                    {(mw.guestInProgress ?? 0)}/{(mw.guestTotal ?? 0)} guests in progress
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
