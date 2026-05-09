import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../../data/technicians.js";
import {
  diffServiceLogPatch,
  emptyServiceLogWorkPatch,
  getPropertyByTechnicianAndSlug,
  getRouteSheetItemsForWeek,
  mapWorkStateToServiceLogPatch,
  workStateFromServiceLogRow,
} from "../../lib/api.js";
import { getTodayEasternDate } from "../../lib/easternDate.js";
import { getActiveRouteSheetSaturdayEastern } from "../../lib/routeSheetWeek.js";
import PropertyHoseControls from "../../components/PropertyHoseControls.jsx";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import ReadingsForm from "../../components/ReadingsForm.jsx";
import ServicePhotoUploads from "../../components/ServicePhotoUploads.jsx";
import { logTechnicianActivity } from "../../utils/activityLog.js";
import { getPoolStart, getSpaStart } from "../../utils/hoseTimers.js";
import {
  ensureServiceLogsForToday,
  getServiceLogRow,
  onSupabaseDataChanged,
  patchServiceLog,
  primePropertiesBySlug,
  primeTechnicianToday,
  resolveDbPropertyId,
} from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import {
  isRouteSheetRowIncludedOnActiveSheet,
  isRouteSheetRowSent,
} from "../../utils/routeSheetSentGuestCheckSummary.js";
import {
  fetchStephenPartitionedRouteInstanceContext,
  mergeRealtimeStephenPartitioned,
  pickTechnicianRouteDetailServiceLog,
  routeSheetItemRowHasLiveInstance,
} from "../../utils/routeInstanceStatus.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import {
  getRouteTypeFromTechnicianPath,
  technicianRouteListPath,
} from "../../utils/technicianRoutePaths.js";
import layoutStyles from "../../styles/layouts.module.css";
import styles from "./StephenPropertyDetailPage.module.css";

export default function StephenPropertyDetailPage() {
  const location = useLocation();
  const { slug: slugParam, propertySlug } = useParams();
  const technicianSlug = (slugParam ?? "").toLowerCase();
  const technician = getTechnicianBySlug(technicianSlug);
  const selectedRouteType = getRouteTypeFromTechnicianPath(location.pathname);

  const needsRouteSheetGate =
    technicianSlug === "stephen" &&
    (selectedRouteType === "turnover" || selectedRouteType === "midweek");

  const [dbProp, setDbProp] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  /** Cycles 0→2 for ".", "..", "..." on the visit loading line */
  const [loadingDotsPhase, setLoadingDotsPhase] = useState(0);
  const [routeSheetRow, setRouteSheetRow] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [sheetCheckDone, setSheetCheckDone] = useState(() => !needsRouteSheetGate);

  const property = dbProp
    ? {
        slug: dbProp.property_slug,
        name: dbProp.name,
        address: dbProp.address,
      }
    : null;

  const listPath = selectedRouteType
    ? technicianRouteListPath(technicianSlug, selectedRouteType)
    : `/technician/${technicianSlug}`;

  useSupabaseSyncTick();

  useEffect(() => {
    let last = 0;
    return onSupabaseDataChanged(() => {
      const nowMs = Date.now();
      /** Avoid rapid nonce storms causing repeated route-context fetches while idle. */
      if (nowMs - last < 1500) return;
      last = nowMs;
      setServiceLogRefreshNonce((n) => n + 1);
    });
  }, []);

  const readingsPoolSigRef = useRef(null);
  const readingsSpaSigRef = useRef(null);
  const chemPoolSigRef = useRef(null);
  const chemSpaSigRef = useRef(null);
  const [, setRoutePoll] = useState(0);

  const [serviceLogsReady, setServiceLogsReady] = useState(false);
  const [serviceLogRefreshNonce, setServiceLogRefreshNonce] = useState(0);
  const [routeScopedLogRow, setRouteScopedLogRow] = useState(
    /** @type {Record<string, unknown> | null} */ (null)
  );
  const [routeScopedLogReady, setRouteScopedLogReady] = useState(() => !needsRouteSheetGate);
  const baselineWorkPatchRef = useRef(null);
  const baselineRowKeyRef = useRef("");
  /** Only clear property row when route (technician + property slug) actually changes — not on same-route refetch. */
  const lastPropertyRouteKeyForClearRef = useRef("");
  const propertyFetchGenerationRef = useRef(0);

  useEffect(() => {
    if (!technicianSlug) return;
    setServiceLogsReady(false);
    void ensureServiceLogsForToday(technicianSlug).finally(() => setServiceLogsReady(true));
  }, [technicianSlug]);

  useEffect(() => {
    readingsPoolSigRef.current = null;
    readingsSpaSigRef.current = null;
    chemPoolSigRef.current = null;
    chemSpaSigRef.current = null;
  }, [propertySlug, technicianSlug]);

  useEffect(() => {
    const id = window.setInterval(() => setRoutePoll((n) => n + 1), 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!technicianSlug || !propertySlug) return;
    let cancelled = false;
    const routeKey = `${technicianSlug}::${String(propertySlug).toLowerCase()}`;
    if (lastPropertyRouteKeyForClearRef.current !== routeKey) {
      lastPropertyRouteKeyForClearRef.current = routeKey;
      setDbProp(null);
    }
    const fetchGen = ++propertyFetchGenerationRef.current;
    setDbLoading(true);
    void getPropertyByTechnicianAndSlug(technicianSlug, propertySlug)
      .then((row) => {
        if (cancelled || fetchGen !== propertyFetchGenerationRef.current) return;
        setDbProp(row);
        setDbLoading(false);
      })
      .catch((e) => {
        if (cancelled || fetchGen !== propertyFetchGenerationRef.current) return;
        console.error("[technician property detail] property fetch failed", e);
        setDbProp(null);
        setDbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [technicianSlug, propertySlug]);

  useEffect(() => {
    if (!needsRouteSheetGate) {
      setRouteSheetRow(null);
      setSheetCheckDone(true);
      return;
    }
    if (dbLoading && !dbProp?.id) {
      setSheetCheckDone(false);
      return;
    }
    if (!dbProp?.id) {
      setRouteSheetRow(null);
      setSheetCheckDone(true);
      return;
    }
    let cancelled = false;
    setSheetCheckDone(false);
    void (async () => {
      const week = getActiveRouteSheetSaturdayEastern();
      const items = await getRouteSheetItemsForWeek(week, selectedRouteType, technicianSlug);
      const sent = (items ?? []).filter(isRouteSheetRowSent).filter(isRouteSheetRowIncludedOnActiveSheet);
      const row =
        sent.find((r) => String(r.property_id ?? "") === String(dbProp.id ?? "")) ?? null;
      if (import.meta.env.DEV) {
        console.log("[technician route detail]", {
          week_start_date: week,
          route_type: selectedRouteType,
          technician_slug: technicianSlug,
          rows_from_supabase: items?.length ?? 0,
          sheet_row_count_after_filters: sent.length,
          matched_property_on_sheet: !!row,
          legacy_static_property: false,
        });
      }
      if (!cancelled) {
        setRouteSheetRow(row);
        setSheetCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsRouteSheetGate, dbLoading, dbProp?.id, selectedRouteType, technicianSlug]);

  useEffect(() => {
    if (!needsRouteSheetGate) {
      setRouteScopedLogRow(null);
      setRouteScopedLogReady(true);
      return;
    }
    if (!sheetCheckDone || !dbProp?.id) {
      setRouteScopedLogRow(null);
      setRouteScopedLogReady(false);
      return;
    }
    if (!routeSheetRow) {
      setRouteScopedLogRow(null);
      setRouteScopedLogReady(true);
      return;
    }
    let cancelled = false;
    /** Do not set routeScopedLogReady false here — realtime refresh (nonce) must not blank the UI while refetching. */
    void (async () => {
      try {
        const rowWeek = String(routeSheetRow?.week_start_date ?? "").trim();
        const weekForLogs = rowWeek || getActiveRouteSheetSaturdayEastern();
        const pidStr = String(dbProp.id);
        const workload = [
          {
            property_id: pidStr,
            id: String(routeSheetRow?.id ?? "").trim(),
            route_sheet_instance_id: routeSheetRow?.route_sheet_instance_id ?? null,
          },
        ];
        const partitioned = await fetchStephenPartitionedRouteInstanceContext(
          technicianSlug,
          weekForLogs,
          /** @type {'turnover'|'midweek'} */ (selectedRouteType),
          workload
        );
        mergeRealtimeStephenPartitioned({
          technicianSlug,
          routeType: /** @type {'turnover'|'midweek'} */ (selectedRouteType),
          weekStartSaturdayYmd: weekForLogs,
          logsByPropertyAndDate: partitioned.logsByPropertyAndDate,
          logsByExplicitItemAndDate: partitioned.logsByExplicitItemAndDate,
          legacyPropertyIds: routeSheetItemRowHasLiveInstance(routeSheetRow) ? [] : [pidStr],
          explicitWorkloadTuples:
            routeSheetItemRowHasLiveInstance(routeSheetRow) && routeSheetRow?.id
              ? [{ propertyId: pidStr, routeSheetItemId: String(routeSheetRow.id) }]
              : [],
        });
        const explicitId =
          routeSheetItemRowHasLiveInstance(routeSheetRow) && routeSheetRow?.id
            ? String(routeSheetRow.id).trim()
            : "";
        const picked = pickTechnicianRouteDetailServiceLog({
          technicianSlug,
          propertyId: pidStr,
          weekStartDate: weekForLogs,
          routeType: /** @type {'turnover'|'midweek'} */ (selectedRouteType),
          logsByPropertyAndDate: partitioned.logsByPropertyAndDate,
          logsByExplicitItemAndDate: partitioned.logsByExplicitItemAndDate,
          explicitRouteSheetItemId: explicitId,
        });
        if (!cancelled) {
          setRouteScopedLogRow(picked);
          setRouteScopedLogReady(true);
        }
      } catch {
        if (!cancelled) {
          setRouteScopedLogRow(null);
          setRouteScopedLogReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    needsRouteSheetGate,
    sheetCheckDone,
    dbProp?.id,
    routeSheetRow,
    technicianSlug,
    selectedRouteType,
    serviceLogRefreshNonce,
  ]);

  useEffect(() => {
    if (!property) return;
    primePropertiesBySlug([property.slug]);
    primeTechnicianToday(technicianSlug, []);
  }, [property, technicianSlug]);

  const resolved = property ? resolveDbPropertyId(property.slug) : null;
  const cachedTodayRow = resolved ? getServiceLogRow(technicianSlug, resolved) : null;
  const effectiveServiceLogRow = useMemo(() => {
    if (!resolved) return null;
    if (needsRouteSheetGate) {
      if (!routeScopedLogReady) return null;
      return routeScopedLogRow ?? cachedTodayRow;
    }
    return cachedTodayRow;
  }, [
    resolved,
    needsRouteSheetGate,
    routeScopedLogReady,
    routeScopedLogRow,
    cachedTodayRow,
    technicianSlug,
  ]);

  /**
   * Single Eastern service_date for all route-gated Supabase patches on this page.
   * Stephen Midweek: never leave blank — fall back to Eastern today so readings/chems/photos match
   * hose rows (temporary isolation fix sometimes yields rows without `service_date` in memory).
   * Stephen Turnover: keep explicit date when present (incl. May 1 emergency row); else omit.
   */
  const routeScopedServiceDateYmd = useMemo(() => {
    if (!needsRouteSheetGate) return undefined;
    const sd = String(effectiveServiceLogRow?.service_date ?? "").trim();
    if (technicianSlug === "stephen" && selectedRouteType === "midweek") {
      return sd || getTodayEasternDate();
    }
    return sd ? sd : undefined;
  }, [
    needsRouteSheetGate,
    technicianSlug,
    selectedRouteType,
    effectiveServiceLogRow?.service_date,
  ]);

  /** Ensure photos/autosave always receive a concrete `service_date` when we know one. */
  const effectiveServiceLogRowForWrites = useMemo(() => {
    if (!effectiveServiceLogRow) return null;
    if (String(effectiveServiceLogRow.service_date ?? "").trim()) {
      return effectiveServiceLogRow;
    }
    if (routeScopedServiceDateYmd) {
      return {
        ...effectiveServiceLogRow,
        service_date: routeScopedServiceDateYmd,
      };
    }
    return effectiveServiceLogRow;
  }, [effectiveServiceLogRow, routeScopedServiceDateYmd]);

  /** Phase 3: same `route_sheet_items.id` as gated `routeSheetRow`; omit when unavailable. */
  const routeSheetItemIdDualWrite = useMemo(() => {
    if (!needsRouteSheetGate || !routeSheetRow?.id) return undefined;
    const s = String(routeSheetRow.id).trim();
    return s || undefined;
  }, [needsRouteSheetGate, routeSheetRow?.id]);

  const combinedLogsReady =
    serviceLogsReady && (!needsRouteSheetGate || routeScopedLogReady);

  const slugForUi = property?.slug ?? propertySlug ?? "";
  const visitDataLoading =
    Boolean(property) && !combinedLogsReady && Boolean(slugForUi);
  const propertyFetchLoading =
    dbLoading && !property && Boolean(propertySlug);
  const loadingVisitUiActive = visitDataLoading || propertyFetchLoading;

  useEffect(() => {
    if (!loadingVisitUiActive) {
      setLoadingDotsPhase(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingDotsPhase((p) => (p + 1) % 3);
    }, 450);
    return () => clearInterval(id);
  }, [loadingVisitUiActive]);

  useEffect(() => {
    baselineRowKeyRef.current = "";
  }, [propertySlug, technicianSlug]);

  useEffect(() => {
    if (!combinedLogsReady || !resolved || !property) return;
    const rowKey = `${technicianSlug}:${property.slug}:${effectiveServiceLogRow?.id ?? "none"}`;
    if (baselineRowKeyRef.current === rowKey && baselineWorkPatchRef.current != null) return;
    baselineRowKeyRef.current = rowKey;
    if (effectiveServiceLogRow) {
      const ws = workStateFromServiceLogRow(effectiveServiceLogRow);
      baselineWorkPatchRef.current = ws
        ? mapWorkStateToServiceLogPatch({
            pool: ws.pool,
            spa: ws.spa,
            poolChem: ws.poolChem,
            spaChem: ws.spaChem,
          })
        : emptyServiceLogWorkPatch();
    } else {
      baselineWorkPatchRef.current = emptyServiceLogWorkPatch();
    }
  }, [
    combinedLogsReady,
    resolved,
    property?.slug,
    technicianSlug,
    effectiveServiceLogRow,
    effectiveServiceLogRow?.id,
  ]);

  const handleWorkStateChange = useCallback(
    async (state) => {
      if (!property) return;
      const prop = property;

      primePropertiesBySlug([prop.slug]);
      const propertyId = resolveDbPropertyId(prop.slug);
      const patchServiceDate = needsRouteSheetGate
        ? routeScopedServiceDateYmd
        : undefined;
      console.log("Supabase write preflight", {
        property_slug: prop.slug,
        property_id: propertyId,
        service_date: patchServiceDate ?? getTodayEasternDate(),
        onConflict: "property_id,service_date",
      });
      if (!propertyId) return;

      const poolHose = getPoolStart(technicianSlug, prop.slug) != null;
      const spaHose = getSpaStart(technicianSlug, prop.slug) != null;
      void poolHose;
      void spaHose;

      const base = baselineWorkPatchRef.current ?? emptyServiceLogWorkPatch();
      const full = mapWorkStateToServiceLogPatch(state);
      const patch = diffServiceLogPatch(base, full);
      const rsid = routeSheetItemIdDualWrite;
      if (Object.keys(patch).length > 0) {
        const r = await patchServiceLog(
          technicianSlug,
          propertyId,
          patch,
          patchServiceDate,
          rsid
        );
        if (r?.ok) {
          baselineWorkPatchRef.current = { ...base, ...patch };
        }
      }

      const poolR = JSON.stringify(state.pool);
      const spaR = JSON.stringify(state.spa);

      if (readingsPoolSigRef.current === null) {
        readingsPoolSigRef.current = poolR;
      } else if (poolR !== readingsPoolSigRef.current) {
        readingsPoolSigRef.current = poolR;
        logTechnicianActivity(technicianSlug, {
          propertySlug: prop.slug,
          propertyName: prop.name,
          type: "pool_reading_updated",
          label: "Updated pool readings",
          ...(rsid ? { route_sheet_item_id: rsid } : {}),
        });
      }

      if (readingsSpaSigRef.current === null) {
        readingsSpaSigRef.current = spaR;
      } else if (spaR !== readingsSpaSigRef.current) {
        readingsSpaSigRef.current = spaR;
        logTechnicianActivity(technicianSlug, {
          propertySlug: prop.slug,
          propertyName: prop.name,
          type: "spa_reading_updated",
          label: "Updated spa readings",
          ...(rsid ? { route_sheet_item_id: rsid } : {}),
        });
      }

      const poolC = JSON.stringify(state.poolChem);
      const spaC = JSON.stringify(state.spaChem);

      if (chemPoolSigRef.current === null) {
        chemPoolSigRef.current = poolC;
      } else if (poolC !== chemPoolSigRef.current) {
        chemPoolSigRef.current = poolC;
        logTechnicianActivity(technicianSlug, {
          propertySlug: prop.slug,
          propertyName: prop.name,
          type: "pool_chemical_updated",
          label: "Adjusted pool chemicals",
          ...(rsid ? { route_sheet_item_id: rsid } : {}),
        });
      }

      if (chemSpaSigRef.current === null) {
        chemSpaSigRef.current = spaC;
      } else if (spaC !== chemSpaSigRef.current) {
        chemSpaSigRef.current = spaC;
        logTechnicianActivity(technicianSlug, {
          propertySlug: prop.slug,
          propertyName: prop.name,
          type: "spa_chemical_updated",
          label: "Adjusted spa chemicals",
          ...(rsid ? { route_sheet_item_id: rsid } : {}),
        });
      }
    },
    [property, technicianSlug, needsRouteSheetGate, routeScopedServiceDateYmd, routeSheetItemIdDualWrite]
  );

  if (!technician) {
    return <Navigate to="/technicians" replace />;
  }

  if (!dbLoading && !property) {
    return <Navigate to={listPath} replace />;
  }

  if (!dbLoading && property && needsRouteSheetGate && sheetCheckDone && !routeSheetRow) {
    return <Navigate to={listPath} replace />;
  }

  const badgeSheet =
    needsRouteSheetGate && routeSheetRow
      ? {
          guest_check: routeSheetRow.guest_check,
          pool_heat: routeSheetRow.pool_heat,
        }
      : null;

  /** From the same `route_sheet_items` row as guest/check, pool heat, and route context. */
  const routeSheetAdminNote = (() => {
    const c = routeSheetRow?.comments;
    if (c == null) return "";
    const t = String(c).trim();
    return t;
  })();

  const displayTitle =
    property?.name ??
    (propertySlug ? String(propertySlug).replace(/-/g, " ") : "Property");
  const displaySubtitle = property?.address ?? "";

  const loadingVisitDataLabel = `Loading visit data${".".repeat(
    loadingDotsPhase + 1
  )}`;

  return (
    <SubpageTemplate
      title={displayTitle}
      subtitle={displaySubtitle || undefined}
      backTo={listPath}
      readableDarkText
      belowBack={
        propertyFetchLoading || visitDataLoading ? (
          <p
            className={layoutStyles.subpageLoadingBanner}
            role="status"
            aria-live="polite"
            aria-label="Loading visit data"
          >
            {loadingVisitDataLabel}
          </p>
        ) : null
      }
    >
      <div className={styles.body}>
        {property && slugForUi ? (
          <>
            <RouteParamBadges
              propertySlug={slugForUi}
              routeSheet={badgeSheet}
              className={styles.routeParams}
            />
            <PropertyHoseControls
              propertySlug={slugForUi}
              technicianSlug={technicianSlug}
              propertyName={property.name}
              enableActivityLog
              propertyId={dbProp?.id != null ? String(dbProp.id) : ""}
              hoseServiceDateYmd={
                needsRouteSheetGate ? routeScopedServiceDateYmd : undefined
              }
              serviceLogRowForHoses={
                needsRouteSheetGate ? effectiveServiceLogRowForWrites : undefined
              }
              routeSheetItemId={needsRouteSheetGate ? routeSheetItemIdDualWrite : undefined}
              spaFillMinutes={dbProp?.spa_fill_minutes}
              onPropertySpaFillUpdated={(row) => {
                setDbProp((prev) => (prev && row ? { ...prev, ...row } : prev));
                /** Avoid primePropertiesBySlug here: it emits supabaseStore → detail's nonce refreshes
                 *  and was clearing routeScopedLogReady mid-refetch, blanking readings/photos momentarily. */
              }}
            />
            <ServicePhotoUploads
              propertySlug={slugForUi}
              propertyName={property.name}
              technicianSlug={technicianSlug}
              serviceLogRow={effectiveServiceLogRowForWrites}
              routeSheetItemId={needsRouteSheetGate ? routeSheetItemIdDualWrite : undefined}
            />
            <ReadingsForm
              key={`${slugForUi}:${effectiveServiceLogRowForWrites?.id ?? "none"}:${String(effectiveServiceLogRowForWrites?.service_date ?? routeScopedServiceDateYmd ?? "")}`}
              idPrefix={slugForUi}
              onWorkStateChange={handleWorkStateChange}
              serviceLogRow={effectiveServiceLogRowForWrites}
              serviceLogsReady={combinedLogsReady}
            />
            {routeSheetAdminNote ? (
              <section
                className={styles.adminNote}
                aria-label="Admin note"
              >
                <h2 className={styles.adminNoteLabel}>Admin note</h2>
                <p className={styles.adminNoteText}>{routeSheetAdminNote}</p>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </SubpageTemplate>
  );
}
