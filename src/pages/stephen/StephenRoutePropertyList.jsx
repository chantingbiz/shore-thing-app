import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRouteSheetItemsForWeek } from "../../lib/api.js";
import { getActiveRouteSheetSaturdayEastern } from "../../lib/routeSheetWeek.js";
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
import {
  isPropertyCompletedToday,
  setPropertyCompletedForDay,
} from "../../utils/propertyCompletion.js";
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

/** Sort: uncompleted guests → uncompleted checks → completed guests → completed checks; tiebreaker sheetOrder. */
function routeCardSortRank(entry, completed) {
  const isGuest = entry.isGuest;
  if (!completed && isGuest) return 0;
  if (!completed && !isGuest) return 1;
  if (completed && isGuest) return 2;
  return 3;
}

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

  const sorted = useMemo(() => {
    void refreshTick;
    return [...routeList].sort((a, b) => {
      const ca = isPropertyCompletedToday(TECH_SLUG, a.slug);
      const cb = isPropertyCompletedToday(TECH_SLUG, b.slug);
      const ra = routeCardSortRank(a, ca);
      const rb = routeCardSortRank(b, cb);
      if (ra !== rb) return ra - rb;
      return a.sheetOrder - b.sheetOrder;
    });
  }, [routeList, refreshTick]);

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

  const titleSuffix = routeType === "turnover" ? "Turnover" : "Midweek";
  const showEmptyMessage = !routeSheetLoading && !loadError && sorted.length === 0;

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
            const completed = isPropertyCompletedToday(TECH_SLUG, p.slug);

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
