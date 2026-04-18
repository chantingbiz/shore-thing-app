import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../../data/technicians.js";
import { TECHNICIAN_ROUTE_TYPES } from "../../data/technicianRouteSheetsMock.js";
import { onSupabaseDataChanged } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { fetchRouteSheetSentGuestCheckSummary } from "../../utils/routeSheetSentGuestCheckSummary.js";
import { technicianRouteListPath } from "../../utils/technicianRoutePaths.js";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./TechnicianRouteTypeChooser.module.css";

function RouteTypeCard({ technicianSlug, routeType, label, summary }) {
  const showChecks = routeType === "turnover" || summary.checkTotal > 0;
  return (
    <Link
      to={technicianRouteListPath(technicianSlug, routeType)}
      className={`${styles.routeCard} ${glass.glassBtn} ${glass.glassBtnFull}`}
    >
      <span className={styles.routeCardTitle}>{label}</span>
      <span className={styles.routeCardMeta}>
        {summary.guestCompleted}/{summary.guestTotal} guests completed
      </span>
      {showChecks ? (
        <span className={styles.routeCardMeta}>
          {summary.checkCompleted}/{summary.checkTotal} checks completed
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Step after picking a technician: choose Turnover vs Midweek route sheet.
 * Counts reflect sent rows in `route_sheet_items` for the active route-sheet week.
 */
export default function TechnicianRouteTypeChooser() {
  const { slug } = useParams();
  const technician = getTechnicianBySlug(slug);
  const techSlug = (technician?.slug ?? "").toLowerCase();
  useSupabaseSyncTick();

  const [reloadNonce, setReloadNonce] = useState(0);
  const [byType, setByType] = useState(() => ({
    turnover: { guestTotal: 0, guestCompleted: 0, checkTotal: 0, checkCompleted: 0 },
    midweek: { guestTotal: 0, guestCompleted: 0, checkTotal: 0, checkCompleted: 0 },
  }));

  useEffect(() => {
    return onSupabaseDataChanged(() => setReloadNonce((n) => n + 1));
  }, []);

  const loadSummaries = useCallback(async () => {
    if (!techSlug) return;
    try {
      const [turnover, midweek] = await Promise.all([
        fetchRouteSheetSentGuestCheckSummary(techSlug, "turnover"),
        fetchRouteSheetSentGuestCheckSummary(techSlug, "midweek"),
      ]);
      setByType({
        turnover: {
          guestTotal: turnover.guestTotal,
          guestCompleted: turnover.guestCompleted,
          checkTotal: turnover.checkTotal,
          checkCompleted: turnover.checkCompleted,
        },
        midweek: {
          guestTotal: midweek.guestTotal,
          guestCompleted: midweek.guestCompleted,
          checkTotal: midweek.checkTotal,
          checkCompleted: midweek.checkCompleted,
        },
      });
    } catch {
      /* keep prior counts */
    }
  }, [techSlug]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries, reloadNonce]);

  if (!technician) {
    return <Navigate to="/technicians" replace />;
  }

  return (
    <SubpageTemplate title={technician.name} backTo="/technicians" readableDarkText>
      <p className={styles.intro}>Choose your route sheet</p>
      <div className={styles.cardStack} role="group" aria-label="Route type">
        {TECHNICIAN_ROUTE_TYPES.map((rt) => (
          <RouteTypeCard
            key={rt}
            technicianSlug={techSlug}
            routeType={rt}
            label={rt === "turnover" ? "Turnover" : "Midweek"}
            summary={byType[rt]}
          />
        ))}
      </div>
    </SubpageTemplate>
  );
}
