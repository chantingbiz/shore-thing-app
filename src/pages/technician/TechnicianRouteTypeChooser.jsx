import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../../data/technicians.js";
import { TECHNICIAN_ROUTE_TYPES } from "../../data/technicianRouteSheetsMock.js";
import { getGuestCheckSummaryForRouteType } from "../../utils/technicianRouteCompletionSummary.js";
import { technicianRouteListPath } from "../../utils/technicianRoutePaths.js";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./TechnicianRouteTypeChooser.module.css";

function RouteTypeCard({ technicianSlug, routeType, label }) {
  const summary = useMemo(
    () => getGuestCheckSummaryForRouteType(technicianSlug, routeType),
    [technicianSlug, routeType]
  );

  return (
    <Link
      to={technicianRouteListPath(technicianSlug, routeType)}
      className={`${styles.routeCard} ${glass.glassBtn} ${glass.glassBtnFull}`}
    >
      <span className={styles.routeCardTitle}>{label}</span>
      <span className={styles.routeCardMeta}>
        {summary.guestCompleted}/{summary.guestTotal} guests completed
      </span>
      <span className={styles.routeCardMeta}>
        {summary.checkCompleted}/{summary.checkTotal} checks completed
      </span>
    </Link>
  );
}

/**
 * Step after picking a technician: choose Turnover vs Midweek route sheet.
 * Each sheet will eventually load its own property list from Supabase (dashboard-sent routes).
 */
export default function TechnicianRouteTypeChooser() {
  const { slug } = useParams();
  const technician = getTechnicianBySlug(slug);
  const techSlug = (technician?.slug ?? "").toLowerCase();

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
          />
        ))}
      </div>
    </SubpageTemplate>
  );
}
