import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getStephenPropertyBySlug } from "../../data/stephenProperties.js";
import { getPropertyByTechnicianAndSlug, mapWorkStateToServiceLogPatch } from "../../lib/api.js";
import PropertyHoseControls from "../../components/PropertyHoseControls.jsx";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import ReadingsForm from "../../components/ReadingsForm.jsx";
import ServicePhotoUploads from "../../components/ServicePhotoUploads.jsx";
import { logTechnicianActivity } from "../../utils/activityLog.js";
import { getPoolStart, getSpaStart } from "../../utils/hoseTimers.js";
import {
  getServiceLogRow,
  patchServiceLog,
  primePropertiesBySlug,
  primeTechnicianToday,
  resolveDbPropertyId,
} from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { getLocalDayKey } from "../../utils/localDay.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./StephenPropertyDetailPage.module.css";

export default function StephenPropertyDetailPage() {
  const { propertySlug } = useParams();
  const staticProp = getStephenPropertyBySlug(propertySlug);
  const [dbProp, setDbProp] = useState(null);
  const [dbLoading, setDbLoading] = useState(() => !staticProp);

  const property =
    staticProp ??
    (dbProp
      ? {
          slug: dbProp.property_slug,
          name: dbProp.name,
          address: dbProp.address,
        }
      : null);

  useSupabaseSyncTick();

  const readingsPoolSigRef = useRef(null);
  const readingsSpaSigRef = useRef(null);
  const chemPoolSigRef = useRef(null);
  const chemSpaSigRef = useRef(null);
  const [, setRoutePoll] = useState(0);

  useEffect(() => {
    readingsPoolSigRef.current = null;
    readingsSpaSigRef.current = null;
    chemPoolSigRef.current = null;
    chemSpaSigRef.current = null;
  }, [propertySlug]);

  useEffect(() => {
    const id = window.setInterval(() => setRoutePoll((n) => n + 1), 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (getStephenPropertyBySlug(propertySlug)) {
      setDbProp(null);
      setDbLoading(false);
      return;
    }
    let cancelled = false;
    setDbLoading(true);
    setDbProp(null);
    void getPropertyByTechnicianAndSlug("stephen", propertySlug).then((row) => {
      if (cancelled) return;
      setDbProp(row);
      setDbLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [propertySlug]);

  useEffect(() => {
    if (!property) return;
    primePropertiesBySlug([property.slug]);
    primeTechnicianToday("stephen", []);
  }, [property]);

  const handleWorkStateChange = useCallback((state) => {
    if (!property) return;
    const prop = property;

    primePropertiesBySlug([prop.slug]);
    const resolved = resolveDbPropertyId(prop.slug);
    console.log("Supabase write preflight", {
      property_slug: prop.slug,
      property_id: resolved,
      service_date: getLocalDayKey(),
      onConflict: "property_id,service_date",
    });
    if (!resolved) return;

    const poolHose = getPoolStart("stephen", prop.slug) != null;
    const spaHose = getSpaStart("stephen", prop.slug) != null;
    void poolHose;
    void spaHose;
    void patchServiceLog("stephen", resolved, {
      ...mapWorkStateToServiceLogPatch(state),
    });

    const poolR = JSON.stringify(state.pool);
    const spaR = JSON.stringify(state.spa);

    if (readingsPoolSigRef.current === null) {
      readingsPoolSigRef.current = poolR;
    } else if (poolR !== readingsPoolSigRef.current) {
      readingsPoolSigRef.current = poolR;
      logTechnicianActivity("stephen", {
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
      logTechnicianActivity("stephen", {
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
      logTechnicianActivity("stephen", {
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
      logTechnicianActivity("stephen", {
        propertySlug: prop.slug,
        propertyName: prop.name,
        type: "spa_chemical_updated",
        label: "Adjusted spa chemicals",
      });
    }
  }, [property]);

  const resolved = property ? resolveDbPropertyId(property.slug) : null;
  const serviceLogRow = resolved ? getServiceLogRow("stephen", resolved) : null;

  if (dbLoading) {
    return (
      <SubpageTemplate title="Loading…" backTo="/technician/stephen" readableDarkText>
        <div className={styles.body}>Loading property…</div>
      </SubpageTemplate>
    );
  }

  if (!property) {
    return <Navigate to="/technician/stephen" replace />;
  }

  return (
    <SubpageTemplate
      title={property.name}
      subtitle={property.address}
      backTo="/technician/stephen"
      readableDarkText
    >
      <div className={styles.body}>
        <RouteParamBadges
          propertySlug={property.slug}
          className={styles.routeParams}
        />
        <PropertyHoseControls
          propertySlug={property.slug}
          technicianSlug="stephen"
          propertyName={property.name}
          enableActivityLog
        />
        <ServicePhotoUploads
          propertySlug={property.slug}
          propertyName={property.name}
          technicianSlug="stephen"
          serviceLogRow={serviceLogRow}
        />
        <ReadingsForm
          idPrefix={property.slug}
          onWorkStateChange={handleWorkStateChange}
          serviceLogRow={serviceLogRow}
        />
      </div>
    </SubpageTemplate>
  );
}
