import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRouteSheetItemsForWeek } from "../../lib/api.js";
import { getTodayEasternDate } from "../../lib/easternDate.js";
import {
  getActiveRouteSheetSaturdayEastern,
  serviceDatesForRouteTypeInSheetWeek,
} from "../../lib/routeSheetWeek.js";
import {
  ensurePropertiesById,
  ensurePropertiesBySlug,
  getPropertyById,
  onSupabaseDataChanged,
  primePropertiesBySlug,
  primeTechnicianToday,
} from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import {
  isRouteSheetRowIncludedOnActiveSheet,
  isRouteSheetRowSent,
} from "../../utils/routeSheetSentGuestCheckSummary.js";
import {
  elapsedSecondsSince,
  formatHoseElapsed,
  getPoolStart,
  getSpaStart,
} from "../../utils/hoseTimers.js";
import { logTechnicianActivity } from "../../utils/activityLog.js";
import { setPropertyCompletedForDay } from "../../utils/propertyCompletion.js";
import {
  ROUTE_CARD_BADGE_LIVE,
  fetchRouteInstanceContext,
  getRouteCardBadgeLabel,
  getRouteInstanceStatus,
  mergeRealtimeTodayServiceLogsIntoIndex,
  routeListSortTier,
} from "../../utils/routeInstanceStatus.js";
import { technicianPropertyDetailPath } from "../../utils/technicianRoutePaths.js";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import glass from "../../styles/glassButtons.module.css";
import { flushPendingWorkNow } from "../../utils/workFlushRegistry.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./StephenPropertiesPage.module.css";

const TECH_SLUG = "stephen";

/**
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   address: string,
 *   id: string,
 *   sheetOrder: number,
 *   isGuest: boolean,
 *   routeSheet: { guest_check?: string | null, pool_heat?: string | null },
 * }} RouteListEntry
 */

/**
 * Stephen route sheet property list: order and membership from sent `route_sheet_items` only.
 *
 * @param {{ routeType: import('../../data/technicianRouteSheetsMock.js').TechnicianRouteType }} props
 */
export default function StephenRoutePropertyList({ routeType }) {
  useSupabaseSyncTick();
  const [now, setNow] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);
  const [routeList, setRouteList] = useState(/** @type {RouteListEntry[]} */ ([]));
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [routeSheetLoading, setRouteSheetLoading] = useState(true);
  /** Route-scoped status per property slug (completion / live hose / in-progress work). */
  const [instanceBySlug, setInstanceBySlug] = useState(
    /** @type {Record<string, { isCompleted: boolean, isLive: boolean, isInProgress: boolean }>} */ ({})
  );

  const loadRouteSheet = useCallback(async () => {
    const week = getActiveRouteSheetSaturdayEastern();
    setLoadError(null);
    setRouteSheetLoading(true);
    try {
      const items = await getRouteSheetItemsForWeek(week, routeType, TECH_SLUG);
      const rawCount = items?.length ?? 0;
      const sent = (items ?? []).filter(isRouteSheetRowSent);
      const listRows = sent.filter(isRouteSheetRowIncludedOnActiveSheet);

      if (import.meta.env.DEV) {
        console.log("[technician route list]", {
          week_start_date: week,
          route_type: routeType,
          technician_slug: TECH_SLUG,
          rows_from_supabase: rawCount,
          after_sent_and_included: listRows.length,
          legacy_sort_or_seed: false,
        });
      }

      const propertyIds = [
        ...new Set(listRows.map((r) => String(r.property_id ?? "").trim()).filter(Boolean)),
      ];
      await ensurePropertiesById(propertyIds);

      /** @type {RouteListEntry[]} */
      const out = [];
      const seen = new Set();
      listRows.forEach((item, sheetOrder) => {
        const pid = String(item.property_id ?? "").trim();
        const p = pid ? getPropertyById(pid) : null;
        const slug = String(p?.property_slug ?? "")
          .trim()
          .toLowerCase();
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        const isGuest = item.guest_check === "guest";
        const guestCheck = isGuest ? "guest" : "check";
        out.push({
          slug,
          name: String(p?.name ?? item.property_name ?? slug),
          address: String(p?.address ?? ""),
          id: pid,
          sheetOrder,
          isGuest,
          routeSheet: {
            guest_check: item.guest_check ?? guestCheck,
            pool_heat: item.pool_heat ?? null,
          },
        });
      });

      setRouteList(out);

      if (import.meta.env.DEV) {
        console.log("[technician route list] rendered", { final_row_count: out.length });
      }
    } catch (e) {
      console.error("[technician route list] load failed", e);
      setLoadError(e?.message ? String(e.message) : String(e));
      setRouteList([]);
    } finally {
      setRouteSheetLoading(false);
    }
  }, [routeType]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadRouteSheet();
  }, [loadRouteSheet, refreshTick]);

  useEffect(() => {
    return onSupabaseDataChanged(() => setRefreshTick((n) => n + 1));
  }, []);

  useEffect(() => {
    const slugs = routeList.map((p) => p.slug);
    primePropertiesBySlug(slugs);
    primeTechnicianToday(TECH_SLUG, []);
    void ensurePropertiesBySlug(slugs);
  }, [routeList]);

  useEffect(() => {
    if (!routeList.length) {
      setInstanceBySlug({});
      return;
    }
    let cancelled = false;
    const week = getActiveRouteSheetSaturdayEastern();
    const ids = routeList.map((p) => String(p.id ?? "").trim()).filter(Boolean);
    void (async () => {
      try {
        const { logsByPropertyAndDate, activityDatesByProperty } = await fetchRouteInstanceContext(
          TECH_SLUG,
          week,
          routeType,
          ids
        );
        mergeRealtimeTodayServiceLogsIntoIndex(TECH_SLUG, logsByPropertyAndDate, ids);
        if (cancelled) return;
        const todayY = getTodayEasternDate();
        /** @type {Record<string, { isCompleted: boolean, isLive: boolean, isInProgress: boolean }>} */
        const next = {};
        for (const p of routeList) {
          next[p.slug] = getRouteInstanceStatus({
            propertyId: String(p.id ?? "").trim(),
            weekStartDate: week,
            routeType,
            logsByPropertyAndDate,
            activityDatesByProperty,
            todayRowOverride: null,
            todayEasternYmd: todayY,
          });
        }
        setInstanceBySlug(next);
      } catch (e) {
        console.error("[technician route list] instance status failed", e);
        if (!cancelled) setInstanceBySlug({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeList, routeType, refreshTick]);

  const sorted = useMemo(() => {
    void refreshTick;
    return [...routeList].sort((a, b) => {
      const sa = instanceBySlug[a.slug] ?? {
        isCompleted: false,
        isLive: false,
        isInProgress: false,
      };
      const sb = instanceBySlug[b.slug] ?? {
        isCompleted: false,
        isLive: false,
        isInProgress: false,
      };
      const ra = routeListSortTier({
        isGuest: a.isGuest,
        isCompleted: sa.isCompleted,
        isLive: sa.isLive,
        isInProgress: sa.isInProgress,
      });
      const rb = routeListSortTier({
        isGuest: b.isGuest,
        isCompleted: sb.isCompleted,
        isLive: sb.isLive,
        isInProgress: sb.isInProgress,
      });
      if (ra !== rb) return ra - rb;
      return a.sheetOrder - b.sheetOrder;
    });
  }, [routeList, refreshTick, instanceBySlug, routeType]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
    setNow(Date.now());
  }, []);

  const toggleCompleted = useCallback((p, e) => {
    e.preventDefault();
    e.stopPropagation();
    flushPendingWorkNow();
    const st = instanceBySlug[p.slug];
    const next = !(st?.isCompleted ?? false);
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
  }, [instanceBySlug]);

  const titleSuffix = routeType === "turnover" ? "Turnover" : "Midweek";
  const showEmptyMessage = !routeSheetLoading && !loadError && sorted.length === 0;
  const weekAnchor = getActiveRouteSheetSaturdayEastern();
  const routeServiceDates = serviceDatesForRouteTypeInSheetWeek(weekAnchor, routeType);
  const todayInRouteWindow = routeServiceDates.includes(getTodayEasternDate());

  return (
    <SubpageTemplate
      title={`Stephen · ${titleSuffix}`}
      backTo={`/technician/${TECH_SLUG}`}
      readableDarkText
    >
      <div className={styles.toolbar}>
        <p className={styles.intro}>Select a property</p>
        <button type="button" className={styles.refreshBtn} onClick={handleRefresh}>
          Refresh
        </button>
      </div>
      {loadError ? (
        <p className={styles.intro} role="alert">
          Could not load route sheet: {loadError}
        </p>
      ) : null}
      {showEmptyMessage ? (
        <p className={styles.intro}>
          No properties on this route for the active week yet. After the office sends your{" "}
          <strong>{titleSuffix}</strong> sheet in the route dashboard, refresh here.
        </p>
      ) : null}
      {!loadError ? (
        <nav className={styles.list} aria-label={`Stephen ${titleSuffix} properties`}>
          {sorted.map((p) => {
            const poolTs = getPoolStart(TECH_SLUG, p.slug);
            const spaTs = getSpaStart(TECH_SLUG, p.slug);
            const poolSec = poolTs != null ? elapsedSecondsSince(poolTs, now) : null;
            const spaSec = spaTs != null ? elapsedSecondsSince(spaTs, now) : null;
            const hasActive = poolSec != null || spaSec != null;
            const st = instanceBySlug[p.slug] ?? {
              isCompleted: false,
              isLive: false,
              isInProgress: false,
            };
            const completed = st.isCompleted;
            const badgeLabel = getRouteCardBadgeLabel(st);

            return (
              <div
                key={p.slug}
                className={`${styles.cardShell} ${completed ? styles.cardShellCompleted : ""}`}
              >
                <Link
                  to={technicianPropertyDetailPath(TECH_SLUG, routeType, p.slug)}
                  className={styles.cardHitArea}
                  aria-label={`Open ${p.name}`}
                />
                <div className={styles.cardInner}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardNameRow}>
                      <span className={styles.cardName}>{p.name}</span>
                    </div>
                    <div className={styles.cardTopRight}>
                      <div className={styles.cardBadges}>
                        {badgeLabel ? (
                          <span
                            className={
                              badgeLabel === ROUTE_CARD_BADGE_LIVE
                                ? styles.liveBadge
                                : styles.inProgressBadge
                            }
                            aria-hidden
                          >
                            {badgeLabel}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`${glass.glassBtn} ${styles.jobGlassBtn} ${
                          !todayInRouteWindow ? styles.jobGlassBtnDisabled : ""
                        }`}
                        aria-label={
                          completed
                            ? "Reopen job — mark property not completed for today"
                            : "Finish job — mark property completed for today"
                        }
                        disabled={!todayInRouteWindow}
                        title={
                          !todayInRouteWindow
                            ? "Finish / reopen is only available on scheduled days for this route sheet."
                            : undefined
                        }
                        onClick={(e) => toggleCompleted(p, e)}
                      >
                        <span className={`${glass.btnLabel} ${styles.jobGlassBtnLabel}`}>
                          {completed ? "Reopen Job" : "Finish Job"}
                        </span>
                      </button>
                    </div>
                  </div>
                  <RouteParamBadges
                    propertySlug={p.slug}
                    routeSheet={p.routeSheet}
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
                          <span className={styles.timerPillValue}>{formatHoseElapsed(poolSec)}</span>
                        </div>
                      ) : null}
                      {spaSec != null ? (
                        <div className={styles.timerPill}>
                          <span className={styles.timerPillLabel}>Spa</span>
                          <span className={styles.timerPillValue}>{formatHoseElapsed(spaSec)}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </nav>
      ) : null}
    </SubpageTemplate>
  );
}
