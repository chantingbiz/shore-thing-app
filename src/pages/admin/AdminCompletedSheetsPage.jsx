import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getCompletedServiceLogsForTechnician,
  getCompletedServiceLogsRecent,
  getPropertiesByIds,
  getRouteSheetItemsForWeek,
  getServiceLogsForTechnicianPropertiesDateRange,
} from "../../lib/api.js";
import { easternSaturdayOnOrBeforeDate, serviceDatesForRouteTypeInSheetWeek } from "../../lib/routeSheetWeek.js";
import { groupCompletedLogsIntoRouteInstances } from "../../utils/adminCompletedRouteInstances.js";
import { getTechnicianBySlug } from "../../data/technicians.js";
import { formatTechnicianSlugForDisplay } from "../../utils/technicianDisplay.js";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import {
  isRouteSheetRowIncludedOnActiveSheet,
  isRouteSheetRowSent,
} from "../../utils/routeSheetSentGuestCheckSummary.js";
import {
  serviceLogRowHasActiveHose,
  serviceLogRowHasMeaningfulNonHoseWork,
} from "../../utils/routeInstanceStatus.js";
import { pickDisplayServiceLog, ymdMinMax } from "../../utils/completedSheetDisplayLog.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import AdminRouteSheetSnapshot from "./AdminRouteSheetSnapshot.jsx";
import AdminReadOnlyWorkView from "./AdminReadOnlyWorkView.jsx";
import shared from "./adminShared.module.css";
import stephenListStyles from "../stephen/StephenPropertiesPage.module.css";
import snapStyles from "./AdminRouteSheetSnapshot.module.css";
import styles from "./AdminCompletedSheetsPage.module.css";
import { formatSheetInstanceLabel } from "../../utils/adminCompletedRouteInstances.js";

export default function AdminCompletedSheetsPage() {
  const {
    techSlug: techParam,
    routeType: routeTypeParam,
    instanceYmd: instanceParam,
    propertyId: propertyIdParam,
  } = useParams();
  const techSlug = String(techParam ?? "").toLowerCase().trim();
  const routeType = String(routeTypeParam ?? "").toLowerCase().trim();
  const instanceYmd = String(instanceParam ?? "").trim();
  const propertyId = String(propertyIdParam ?? "").trim();

  const instanceYmdOk = /^\d{4}-\d{2}-\d{2}$/.test(instanceYmd);
  const routeTypeOk = routeType === "turnover" || routeType === "midweek";
  const isLevel4 = !!(techSlug && routeTypeOk && instanceYmdOk && propertyId);
  const isLevel3 = !!(techSlug && routeTypeOk && instanceYmdOk && !propertyId);

  const isLevel2 = !!(techSlug && !isLevel3 && !isLevel4);
  const isLevel1 = !techSlug;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [refreshTick, setRefreshTick] = useState(0);

  const [allInstances, setAllInstances] = useState(
    /** @type {Awaited<ReturnType<typeof groupCompletedLogsIntoRouteInstances>>} */ ([])
  );

  const loadLevel1 = useCallback(async () => {
    const logs = await getCompletedServiceLogsRecent(900);
    const grouped = await groupCompletedLogsIntoRouteInstances(logs);
    setAllInstances(grouped);
  }, []);

  const loadLevel2 = useCallback(async () => {
    const logs = await getCompletedServiceLogsForTechnician(techSlug, 900);
    const grouped = await groupCompletedLogsIntoRouteInstances(logs);
    setAllInstances(grouped);
  }, [techSlug]);

  useEffect(() => {
    if (isLevel3 || isLevel4) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        if (isLevel1) await loadLevel1();
        else if (isLevel2) await loadLevel2();
        else setAllInstances([]);
        if (cancelled) return;
      } catch (e) {
        if (!cancelled) {
          setAllInstances([]);
          setError(e?.message ? String(e.message) : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLevel1, isLevel2, isLevel3, isLevel4, loadLevel1, loadLevel2, refreshTick]);

  const technicians = useMemo(() => {
    const s = new Set(allInstances.map((i) => i.techSlug).filter(Boolean));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [allInstances]);

  const instancesForTech = useMemo(() => {
    if (!techSlug) return [];
    return allInstances.filter((i) => i.techSlug === techSlug);
  }, [allInstances, techSlug]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  if (techParam && !techSlug) {
    return <Navigate to="/administrator/completed-sheets" replace />;
  }

  if (routeTypeParam && !routeTypeOk) {
    return <Navigate to={`/administrator/completed-sheets/${encodeURIComponent(techSlug)}`} replace />;
  }

  if (techSlug && routeTypeParam && instanceParam && !instanceYmdOk) {
    return (
      <Navigate to={`/administrator/completed-sheets/${encodeURIComponent(techSlug)}`} replace />
    );
  }

  if (isLevel4) {
    return (
      <CompletedSheetPropertyDetail
        techSlug={techSlug}
        routeType={/** @type {'turnover'|'midweek'} */ (routeType)}
        instanceYmd={instanceYmd}
        propertyId={propertyId}
        onRefresh={handleRefresh}
        refreshTick={refreshTick}
      />
    );
  }

  if (isLevel3) {
    return (
      <CompletedSheetInstanceDetail
        techSlug={techSlug}
        routeType={/** @type {'turnover'|'midweek'} */ (routeType)}
        instanceYmd={instanceYmd}
        onRefresh={handleRefresh}
        refreshTick={refreshTick}
      />
    );
  }

  const backTo = isLevel2 ? "/administrator/completed-sheets" : "/administrator";
  const title = isLevel2
    ? `Completed sheets · ${formatTechnicianSlugForDisplay(techSlug)}`
    : "Completed sheets";

  return (
    <SubpageTemplate title={title} backTo={backTo} readableDarkText>
      <div className={`${styles.toolbar} ${styles.toolbarActionsOnly}`}>
        <button type="button" className={styles.refreshBtn} onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.placeholder}>Loading…</p>
      ) : isLevel1 ? (
        !technicians.length ? (
          <p className={styles.placeholder}>No completed route sheets in recent live logs.</p>
        ) : (
          <nav className={shared.list} aria-label="Technicians with completed sheets">
            {technicians.map((slug) => (
              <Link
                key={slug}
                to={`/administrator/completed-sheets/${encodeURIComponent(slug)}`}
                className={shared.cardLink}
              >
                <p className={shared.cardTitle}>{formatTechnicianSlugForDisplay(slug)}</p>
              </Link>
            ))}
          </nav>
        )
      ) : !instancesForTech.length ? (
        <p className={styles.placeholder}>No matching completed sheet instances for this technician.</p>
      ) : (
        <nav className={shared.list} aria-label="Completed sheet instances">
          {instancesForTech.map((inst) => (
            <Link
              key={inst.instanceKey}
              to={`/administrator/completed-sheets/${encodeURIComponent(inst.techSlug)}/${inst.routeType}/${inst.anchorYmd}`}
              className={shared.cardLink}
            >
              <p className={shared.cardTitle}>{inst.label}</p>
              <p className={shared.cardMeta}>{inst.logs.length} completed propert{inst.logs.length === 1 ? "y" : "ies"}</p>
            </Link>
          ))}
        </nav>
      )}
    </SubpageTemplate>
  );
}

/**
 * @param {{
 *   techSlug: string,
 *   routeType: 'turnover'|'midweek',
 *   instanceYmd: string,
 *   propertyId: string,
 *   onRefresh: () => void,
 *   refreshTick: number,
 * }} props
 */
function CompletedSheetPropertyDetail({ techSlug, routeType, instanceYmd, propertyId, onRefresh, refreshTick }) {
  const weekSat = easternSaturdayOnOrBeforeDate(instanceYmd);
  const serviceDates = useMemo(() => {
    if (routeType === "turnover") {
      return serviceDatesForRouteTypeInSheetWeek(weekSat, "turnover");
    }
    const mid = new Set(serviceDatesForRouteTypeInSheetWeek(weekSat, "midweek"));
    return mid.has(instanceYmd) ? [instanceYmd] : [];
  }, [routeType, weekSat, instanceYmd]);

  const dateSet = useMemo(() => new Set(serviceDates ?? []), [serviceDates]);
  const sheetInstancePath = `/administrator/completed-sheets/${encodeURIComponent(techSlug)}/${routeType}/${instanceYmd}`;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [payload, setPayload] = useState(
    /** @type {null | {
     *   name: string,
     *   address: string,
     *   slug: string,
     *   completedForInstance: boolean,
     *   displayLog: Record<string, unknown> | null,
     *   isLive: boolean,
     *   isInProgress: boolean,
     *   isGuest: boolean,
     *   routeSheet: { guest_check: string, pool_heat: unknown },
     * }} */ (null)
  );

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const slug = String(techSlug ?? "").toLowerCase().trim();
      const week = String(weekSat ?? "").trim();
      const rt = routeType;
      const pid = String(propertyId ?? "").trim();
      if (!slug || !week || (rt !== "turnover" && rt !== "midweek") || !pid || !serviceDates.length) {
        setPayload(null);
        return;
      }
      const items = await getRouteSheetItemsForWeek(week, rt, slug);
      const listRows = (items ?? []).filter(isRouteSheetRowSent).filter(isRouteSheetRowIncludedOnActiveSheet);
      const sheetItem = listRows.find((r) => String(r.property_id ?? "").trim() === pid);
      if (!sheetItem) {
        setPayload(null);
        return;
      }
      const propsRows = await getPropertiesByIds([pid]);
      const p = propsRows?.[0];
      const slugLower = String(p?.property_slug ?? "").trim().toLowerCase();
      if (!slugLower) {
        setPayload(null);
        return;
      }
      const { min, max } = ymdMinMax(serviceDates);
      const allLogs =
        min && max
          ? await getServiceLogsForTechnicianPropertiesDateRange(slug, [pid], min, max)
          : [];
      const plogs = [];
      for (const log of allLogs ?? []) {
        const sd = String(log?.service_date ?? "").trim();
        if (dateSet.has(sd)) plogs.push(log);
      }
      const completedForInstance = plogs.some((r) => !!r.completed);
      const displayLog = pickDisplayServiceLog(plogs);
      const isLive = !!(displayLog && serviceLogRowHasActiveHose(displayLog));
      const isInProgress =
        !completedForInstance &&
        !isLive &&
        !!(displayLog && serviceLogRowHasMeaningfulNonHoseWork(displayLog));
      const isGuest = sheetItem.guest_check === "guest";
      const guestCheck = isGuest ? "guest" : "check";
      setPayload({
        name: String(p?.name ?? sheetItem.property_name ?? slugLower),
        address: String(p?.address ?? ""),
        slug: slugLower,
        completedForInstance,
        displayLog,
        isLive,
        isInProgress,
        isGuest,
        routeSheet: {
          guest_check: sheetItem.guest_check ?? guestCheck,
          pool_heat: sheetItem.pool_heat ?? null,
        },
      });
    } catch (e) {
      setPayload(null);
      setLoadError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }, [techSlug, weekSat, routeType, propertyId, serviceDates, dateSet]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  if (!serviceDates.length) {
    return <Navigate to={`/administrator/completed-sheets/${encodeURIComponent(techSlug)}`} replace />;
  }

  if (loading) {
    return (
      <SubpageTemplate title="Property" subtitle="Loading…" backTo={sheetInstancePath} readableDarkText>
        <p className={styles.placeholder}>Loading…</p>
      </SubpageTemplate>
    );
  }

  if (loadError) {
    return (
      <SubpageTemplate title="Property" backTo={sheetInstancePath} readableDarkText>
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      </SubpageTemplate>
    );
  }

  if (!payload) {
    return <Navigate to={sheetInstancePath} replace />;
  }

  const techName = getTechnicianBySlug(techSlug)?.name;
  const instanceLabel = formatSheetInstanceLabel(routeType, instanceYmd);

  return (
    <SubpageTemplate
      title={payload.name}
      subtitle={`${techName ?? formatTechnicianSlugForDisplay(techSlug)} · ${instanceLabel} · read-only`}
      backTo={sheetInstancePath}
      readableDarkText
    >
      <div className={`${styles.toolbar} ${styles.toolbarActionsOnly}`}>
        <button type="button" className={styles.refreshBtn} onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className={`${snapStyles.propDetails} ${snapStyles.propertyDetailPage}`}>
        <div className={`${snapStyles.propSummaryInner} ${snapStyles.propertyPageHeader}`}>
          <div className={snapStyles.summaryTop}>
            <p className={snapStyles.summaryName}>{payload.name}</p>
            <div className={snapStyles.summaryBadges}>
              {payload.isGuest ? (
                <span className={`${snapStyles.pill} ${snapStyles.pillGuest}`}>Guest</span>
              ) : (
                <span className={`${snapStyles.pill} ${snapStyles.pillCheck}`}>Check</span>
              )}
              {payload.completedForInstance ? (
                <span className={`${snapStyles.pill} ${snapStyles.pillDone}`}>Completed</span>
              ) : payload.isLive ? (
                <span className={`${snapStyles.pill} ${snapStyles.pillOpen}`}>Live</span>
              ) : payload.isInProgress ? (
                <span className={`${snapStyles.pill} ${snapStyles.pillIp}`}>In progress</span>
              ) : (
                <span className={snapStyles.pill}>Not completed</span>
              )}
            </div>
          </div>
          {payload.address ? <p className={snapStyles.address}>{payload.address}</p> : null}
          <RouteParamBadges
            propertySlug={payload.slug}
            routeSheet={payload.routeSheet}
            className={stephenListStyles.routeBadges}
          />
        </div>
        <div className={snapStyles.workBody}>
          <AdminReadOnlyWorkView
            snapshotMode
            centerServicePhotos
            serviceLog={payload.displayLog}
            techSlug={techSlug}
            propertySlug={payload.slug}
          />
        </div>
      </div>
    </SubpageTemplate>
  );
}

/**
 * @param {{
 *   techSlug: string,
 *   routeType: 'turnover'|'midweek',
 *   instanceYmd: string,
 *   onRefresh: () => void,
 *   refreshTick: number,
 * }} props
 */
function CompletedSheetInstanceDetail({ techSlug, routeType, instanceYmd, onRefresh, refreshTick }) {
  const weekSat = easternSaturdayOnOrBeforeDate(instanceYmd);
  const serviceDates = useMemo(() => {
    if (routeType === "turnover") {
      return serviceDatesForRouteTypeInSheetWeek(weekSat, "turnover");
    }
    const mid = new Set(serviceDatesForRouteTypeInSheetWeek(weekSat, "midweek"));
    return mid.has(instanceYmd) ? [instanceYmd] : [];
  }, [routeType, weekSat, instanceYmd]);

  const sheetTitle = formatSheetInstanceLabel(routeType, instanceYmd);
  const techName = getTechnicianBySlug(techSlug)?.name;

  if (!serviceDates.length) {
    return (
      <Navigate to={`/administrator/completed-sheets/${encodeURIComponent(techSlug)}`} replace />
    );
  }

  return (
    <SubpageTemplate
      title={sheetTitle}
      subtitle={`${techName ?? formatTechnicianSlugForDisplay(techSlug)} · read-only`}
      backTo={`/administrator/completed-sheets/${encodeURIComponent(techSlug)}`}
      readableDarkText
    >
      <div className={`${styles.toolbar} ${styles.toolbarActionsOnly}`}>
        <button type="button" className={styles.refreshBtn} onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <AdminRouteSheetSnapshot
        techSlug={techSlug}
        weekSatYmd={weekSat}
        routeType={routeType}
        serviceDates={serviceDates}
        instanceRouteYmd={instanceYmd}
        refreshTick={refreshTick}
      />
    </SubpageTemplate>
  );
}
