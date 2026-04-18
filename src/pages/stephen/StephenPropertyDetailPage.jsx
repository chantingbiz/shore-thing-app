import { useCallback, useEffect, useRef, useState } from "react";
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
import { getLocalDayKey } from "../../utils/localDay.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import {
  getRouteTypeFromTechnicianPath,
  technicianRouteListPath,
} from "../../utils/technicianRoutePaths.js";
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

  const readingsPoolSigRef = useRef(null);
  const readingsSpaSigRef = useRef(null);
  const chemPoolSigRef = useRef(null);
  const chemSpaSigRef = useRef(null);
  const [, setRoutePoll] = useState(0);

  const [serviceLogsReady, setServiceLogsReady] = useState(false);
  const baselineWorkPatchRef = useRef(null);
  const baselineRowKeyRef = useRef("");

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
    setDbLoading(true);
    setDbProp(null);
    void getPropertyByTechnicianAndSlug(technicianSlug, propertySlug).then((row) => {
      if (cancelled) return;
      setDbProp(row);
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
    if (dbLoading) {
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
    if (!property) return;
    primePropertiesBySlug([property.slug]);
    primeTechnicianToday(technicianSlug, []);
  }, [property, technicianSlug]);

  const resolved = property ? resolveDbPropertyId(property.slug) : null;
  const serviceLogRow = resolved ? getServiceLogRow(technicianSlug, resolved) : null;

  useEffect(() => {
    baselineRowKeyRef.current = "";
  }, [propertySlug, technicianSlug]);

  useEffect(() => {
    if (!serviceLogsReady || !resolved || !property) return;
    const rowKey = `${technicianSlug}:${property.slug}:${serviceLogRow?.id ?? "none"}`;
    if (baselineRowKeyRef.current === rowKey && baselineWorkPatchRef.current != null) return;
    baselineRowKeyRef.current = rowKey;
    if (serviceLogRow) {
      const ws = workStateFromServiceLogRow(serviceLogRow);
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
    serviceLogsReady,
    resolved,
    property?.slug,
    technicianSlug,
    serviceLogRow,
    serviceLogRow?.id,
  ]);

  const handleWorkStateChange = useCallback(
    async (state) => {
      if (!property) return;
      const prop = property;

      primePropertiesBySlug([prop.slug]);
      const propertyId = resolveDbPropertyId(prop.slug);
      console.log("Supabase write preflight", {
        property_slug: prop.slug,
        property_id: propertyId,
        service_date: getLocalDayKey(),
        onConflict: "property_id,service_date",
      });
      if (!propertyId) return;

      const poolHose = getPoolStart(technicianSlug, prop.slug) != null;
      const spaHose = getSpaStart(technicianSlug, prop.slug) != null;
      void poolHose;
      void spaHose;

      const base = baselineWorkPatchRef.current;
      if (base != null) {
        const full = mapWorkStateToServiceLogPatch(state);
        const patch = diffServiceLogPatch(base, full);
        if (Object.keys(patch).length > 0) {
          const r = await patchServiceLog(technicianSlug, propertyId, patch);
          if (r?.ok) {
            baselineWorkPatchRef.current = { ...base, ...patch };
          }
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
        });
      }
    },
    [property, technicianSlug]
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

  const displayTitle =
    property?.name ??
    (propertySlug ? String(propertySlug).replace(/-/g, " ") : "Property");
  const displaySubtitle = property?.address ?? "";
  const slugForUi = property?.slug ?? propertySlug ?? "";

  return (
    <SubpageTemplate
      title={displayTitle}
      subtitle={displaySubtitle || undefined}
      backTo={listPath}
      readableDarkText
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
            />
            <ServicePhotoUploads
              propertySlug={slugForUi}
              propertyName={property.name}
              technicianSlug={technicianSlug}
              serviceLogRow={serviceLogRow}
            />
            <ReadingsForm
              idPrefix={slugForUi}
              onWorkStateChange={handleWorkStateChange}
              serviceLogRow={serviceLogRow}
              serviceLogsReady={serviceLogsReady}
            />
          </>
        ) : null}
      </div>
    </SubpageTemplate>
  );
}
