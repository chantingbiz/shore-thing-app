import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getPropertiesByIds,
  getRouteSheetItemsForWeek,
  getServiceLogsForTechnicianPropertiesDateRange,
} from "../../lib/api.js";
import {
  isRouteSheetRowIncludedOnActiveSheet,
  isRouteSheetRowSent,
} from "../../utils/routeSheetSentGuestCheckSummary.js";
import {
  routeListSortTier,
  serviceLogRowHasActiveHose,
  serviceLogRowHasMeaningfulNonHoseWork,
} from "../../utils/routeInstanceStatus.js";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import ServicePhotoGallery from "../../components/ServicePhotoGallery.jsx";
import { pickDisplayServiceLog, ymdMinMax } from "../../utils/completedSheetDisplayLog.js";
import { servicePhotoItemsFromRow } from "../../utils/servicePhotoSlots.js";
import shared from "./adminShared.module.css";
import stephenListStyles from "../stephen/StephenPropertiesPage.module.css";
import snapStyles from "./AdminRouteSheetSnapshot.module.css";

/**
 * Full sent-route sheet (read-only) with per-property work snapshot — mirrors technician route
 * list structure: sheet order, guest/check badges, completion / in-progress context; each row
 * links to the full read-only property page.
 *
 * @param {{
 *   techSlug: string,
 *   weekSatYmd: string,
 *   routeType: 'turnover'|'midweek',
 *   serviceDates: string[],
 *   instanceRouteYmd: string,
 *   refreshTick: number,
 * }} props
 */
export default function AdminRouteSheetSnapshot({
  techSlug,
  weekSatYmd,
  routeType,
  serviceDates,
  instanceRouteYmd,
  refreshTick,
}) {
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [loading, setLoading] = useState(true);
  /** @type {any[]} */
  const [rows, setRows] = useState([]);

  const dateSet = useMemo(() => new Set(serviceDates ?? []), [serviceDates]);

  const load = useCallback(async () => {
    const slug = String(techSlug ?? "").toLowerCase().trim();
    const week = String(weekSatYmd ?? "").trim();
    const rt = routeType;
    if (!slug || !week || (rt !== "turnover" && rt !== "midweek") || !serviceDates?.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    try {
      const items = await getRouteSheetItemsForWeek(week, rt, slug);
      const listRows = (items ?? []).filter(isRouteSheetRowSent).filter(isRouteSheetRowIncludedOnActiveSheet);

      const propertyIds = [
        ...new Set(listRows.map((r) => String(r.property_id ?? "").trim()).filter(Boolean)),
      ];
      const props = propertyIds.length ? await getPropertiesByIds(propertyIds) : [];
      /** @type {Map<string, Record<string, unknown>>} */
      const propById = new Map();
      for (const p of props ?? []) {
        if (p?.id) propById.set(String(p.id), p);
      }

      const { min, max } = ymdMinMax(serviceDates);
      const allLogs =
        propertyIds.length && min && max
          ? await getServiceLogsForTechnicianPropertiesDateRange(slug, propertyIds, min, max)
          : [];

      /** @type {Map<string, Record<string, unknown>[]>} */
      const logsByPid = new Map();
      for (const log of allLogs ?? []) {
        const pid = String(log?.property_id ?? "").trim();
        const sd = String(log?.service_date ?? "").trim();
        if (!pid || !dateSet.has(sd)) continue;
        if (!logsByPid.has(pid)) logsByPid.set(pid, []);
        logsByPid.get(pid).push(log);
      }

      /** @type {any[]} */
      const built = [];
      const seen = new Set();
      listRows.forEach((item, sheetOrder) => {
        const pid = String(item.property_id ?? "").trim();
        const p = pid ? propById.get(pid) : null;
        const slugLower = String(p?.property_slug ?? "")
          .trim()
          .toLowerCase();
        if (!slugLower || seen.has(slugLower)) return;
        seen.add(slugLower);
        const isGuest = item.guest_check === "guest";
        const guestCheck = isGuest ? "guest" : "check";
        const plogs = logsByPid.get(pid) ?? [];
        const completedForInstance = plogs.some((r) => !!r.completed);
        const displayLog = pickDisplayServiceLog(plogs);
        const isLive = !!(displayLog && serviceLogRowHasActiveHose(displayLog));
        const isInProgress =
          !completedForInstance &&
          !isLive &&
          !!(displayLog && serviceLogRowHasMeaningfulNonHoseWork(displayLog));
        built.push({
          key: pid || slugLower,
          slug: slugLower,
          name: String(p?.name ?? item.property_name ?? slugLower),
          address: String(p?.address ?? ""),
          id: pid,
          sheetOrder,
          isGuest,
          routeSheet: {
            guest_check: item.guest_check ?? guestCheck,
            pool_heat: item.pool_heat ?? null,
          },
          completedForInstance,
          displayLog,
          isLive,
          isInProgress,
        });
      });

      built.sort((a, b) => {
        const ra = routeListSortTier({
          isGuest: a.isGuest,
          isCompleted: a.completedForInstance,
          isLive: a.isLive,
          isInProgress: a.isInProgress,
        });
        const rb = routeListSortTier({
          isGuest: b.isGuest,
          isCompleted: b.completedForInstance,
          isLive: b.isLive,
          isInProgress: b.isInProgress,
        });
        if (ra !== rb) return ra - rb;
        const ta = Date.parse(String(a.displayLog?.completed_at ?? ""));
        const tb = Date.parse(String(b.displayLog?.completed_at ?? ""));
        const ma = Number.isFinite(ta) ? ta : 0;
        const mb = Number.isFinite(tb) ? tb : 0;
        if (mb !== ma) return mb - ma;
        return a.sheetOrder - b.sheetOrder;
      });

      setRows(built);
    } catch (e) {
      setRows([]);
      setLoadError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }, [techSlug, weekSatYmd, routeType, serviceDates, dateSet]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const stats = useMemo(() => {
    let gTot = 0;
    let gDone = 0;
    let cTot = 0;
    let cDone = 0;
    for (const r of rows) {
      if (r.isGuest) {
        gTot++;
        if (r.completedForInstance) gDone++;
      } else {
        cTot++;
        if (r.completedForInstance) cDone++;
      }
    }
    return { gTot, gDone, cTot, cDone };
  }, [rows]);

  if (loading) {
    return <p className={snapStyles.subHeader}>Loading sheet…</p>;
  }

  if (loadError) {
    return (
      <p className={snapStyles.subHeader} style={{ color: "#8b1538" }} role="alert">
        {loadError}
      </p>
    );
  }

  if (!rows.length) {
    return (
      <p className={snapStyles.subHeader}>
        No sent properties on this route sheet for the selected week and type.
      </p>
    );
  }

  return (
    <div>
      <div className={`${shared.routeDayStats} ${snapStyles.statsWrap}`} aria-label="Sheet completion summary">
        {routeType === "turnover" ? (
          <>
            <p className={shared.routeStatPill}>
              Guests {stats.gDone}/{stats.gTot} completed
            </p>
            <p className={shared.routeStatPill}>
              Checks {stats.cDone}/{stats.cTot} completed
            </p>
          </>
        ) : (
          <p className={shared.routeStatPill}>
            Guests {stats.gDone}/{stats.gTot} completed
          </p>
        )}
      </div>

      <nav className={stephenListStyles.list} aria-label="Route sheet properties">
        {rows.map((entry) => {
          const photoItems = servicePhotoItemsFromRow(entry.displayLog);
          const to = `/administrator/completed-sheets/${encodeURIComponent(techSlug)}/${routeType}/${instanceRouteYmd}/${encodeURIComponent(entry.id)}`;
          return (
            <div
              key={entry.key}
              className={`${snapStyles.propBlock} ${snapStyles.sheetCardWrap} ${snapStyles.sheetPreviewCard}`}
            >
              <div className={`${shared.cardLink} ${snapStyles.sheetCardInner}`}>
                <Link to={to} className={snapStyles.sheetPropertyLink}>
                  <div className={snapStyles.propSummaryInner}>
                    <div className={snapStyles.summaryTop}>
                      <p className={snapStyles.summaryName}>{entry.name}</p>
                      <div className={snapStyles.summaryBadges}>
                        {entry.isGuest ? (
                          <span className={`${snapStyles.pill} ${snapStyles.pillGuest}`}>Guest</span>
                        ) : (
                          <span className={`${snapStyles.pill} ${snapStyles.pillCheck}`}>Check</span>
                        )}
                        {entry.completedForInstance ? (
                          <span className={`${snapStyles.pill} ${snapStyles.pillDone}`}>Completed</span>
                        ) : entry.isLive ? (
                          <span className={`${snapStyles.pill} ${snapStyles.pillOpen}`}>Live</span>
                        ) : entry.isInProgress ? (
                          <span className={`${snapStyles.pill} ${snapStyles.pillIp}`}>In progress</span>
                        ) : (
                          <span className={snapStyles.pill}>Not completed</span>
                        )}
                      </div>
                    </div>
                    {entry.address ? <p className={snapStyles.address}>{entry.address}</p> : null}
                    <RouteParamBadges
                      propertySlug={entry.slug}
                      routeSheet={entry.routeSheet}
                      className={stephenListStyles.routeBadges}
                    />
                    <p className={snapStyles.expandHint}>Open full property view</p>
                  </div>
                </Link>
                {photoItems.length > 0 ? (
                  <div className={snapStyles.sheetGallerySlot} aria-label="Service photo previews">
                    <ServicePhotoGallery
                      items={photoItems}
                      variant="compact"
                      listClassName={snapStyles.sheetPhotoList}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
