import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getStephenPropertyBySlug } from "../../data/stephenProperties.js";
import PropertyHoseControls from "../../components/PropertyHoseControls.jsx";
import RouteParamBadges from "../../components/RouteParamBadges.jsx";
import ReadingsForm from "../../components/ReadingsForm.jsx";
import { logTechnicianActivity } from "../../utils/activityLog.js";
import { getPoolStart, getSpaStart } from "../../utils/hoseTimers.js";
import {
  patchServiceLog,
  primePropertiesBySlug,
  primeTechnicianToday,
  resolveDbPropertyId,
} from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { mapWorkStateToServiceLogPatch } from "../../lib/api.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./StephenPropertyDetailPage.module.css";

export default function StephenPropertyDetailPage() {
  const { propertySlug } = useParams();
  const property = getStephenPropertyBySlug(propertySlug);
  useSupabaseSyncTick();

  const readingsSigRef = useRef(null);
  const chemSigRef = useRef(null);
  const [, setRoutePoll] = useState(0);

  useEffect(() => {
    readingsSigRef.current = null;
    chemSigRef.current = null;
  }, [propertySlug]);

  useEffect(() => {
    const id = window.setInterval(() => setRoutePoll((n) => n + 1), 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!property) return;
    primePropertiesBySlug([property.slug]);
    primeTechnicianToday("stephen", []);
  }, [property]);

  const handleWorkStateChange = useCallback((state) => {
    const prop = getStephenPropertyBySlug(propertySlug);
    if (!prop) return;

    primePropertiesBySlug([prop.slug]);
    const resolved = resolveDbPropertyId(prop.slug);
    console.log("Supabase write preflight", {
      property_slug: prop.slug,
      property_id: resolved,
      service_date: new Date().toISOString().split("T")[0],
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

    const r = JSON.stringify({ pool: state.pool, spa: state.spa });
    if (readingsSigRef.current === null) {
      readingsSigRef.current = r;
    } else if (r !== readingsSigRef.current) {
      readingsSigRef.current = r;
      logTechnicianActivity("stephen", {
        propertySlug: prop.slug,
        propertyName: prop.name,
        type: "reading_updated",
        label: "Updated readings",
      });
    }

    const c = JSON.stringify({
      poolChem: state.poolChem,
      spaChem: state.spaChem,
    });
    if (chemSigRef.current === null) {
      chemSigRef.current = c;
    } else if (c !== chemSigRef.current) {
      chemSigRef.current = c;
      logTechnicianActivity("stephen", {
        propertySlug: prop.slug,
        propertyName: prop.name,
        type: "chemical_updated",
        label: "Adjusted chemicals",
      });
    }
  }, [propertySlug]);

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
        <ReadingsForm
          idPrefix={property.slug}
          onWorkStateChange={handleWorkStateChange}
        />
      </div>
    </SubpageTemplate>
  );
}
