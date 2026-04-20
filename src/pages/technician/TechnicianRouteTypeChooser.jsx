import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../../data/technicians.js";
import { formatTechnicianSlugForDisplay } from "../../utils/technicianDisplay.js";
import { TECHNICIAN_ROUTE_TYPES } from "../../data/technicianRouteSheetsMock.js";
import { onSupabaseDataChanged } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import { fetchRouteSheetSentGuestCheckSummary } from "../../utils/routeSheetSentGuestCheckSummary.js";
import { technicianRouteListPath } from "../../utils/technicianRoutePaths.js";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./TechnicianRouteTypeChooser.module.css";

function RouteTypeCard({ technicianSlug, routeType, label, summary }) {
  const gDone = summary.guestCompleted ?? 0;
  const gTot = summary.guestTotal ?? 0;
  const gWip = summary.guestInProgress ?? 0;
  const cDone = summary.checkCompleted ?? 0;
  const cTot = summary.checkTotal ?? 0;
  const cWip = summary.checkInProgress ?? 0;

  const guestsLineComplete = gTot > 0 && gDone === gTot;
  const checksLineComplete = cTot > 0 && cDone === cTot;

  /** @type {{ key: string, text: string }[]} */
  const wipChips = [];
  if (routeType === "turnover") {
    if (gWip > 0) {
      wipChips.push({
        key: "guest-wip",
        text: `${gWip} guest${gWip === 1 ? "" : "s"} in progress`,
      });
    }
    if (cWip > 0) {
      wipChips.push({
        key: "check-wip",
        text: `${cWip} check${cWip === 1 ? "" : "es"} in progress`,
      });
    }
  } else if (gWip > 0) {
    wipChips.push({
      key: "guest-wip",
      text: `${gWip} guest${gWip === 1 ? "" : "s"} in progress`,
    });
  }

  return (
    <Link
      to={technicianRouteListPath(technicianSlug, routeType)}
      className={`${styles.routeCard} ${glass.glassBtn} ${glass.glassBtnFull}`}
    >
      <span className={styles.routeCardTitle}>{label}</span>
      <div className={styles.routeCardBody}>
        {routeType === "turnover" ? (
          <div className={styles.routeCardStats}>
            <p
              className={`${styles.routeCardStat}${
                guestsLineComplete ? ` ${styles.routeCardStatComplete}` : ""
              }`}
            >
              Guests:{" "}
              <span className={styles.routeCardStatEm}>
                {gDone}/{gTot} completed
              </span>
            </p>
            <p
              className={`${styles.routeCardStat}${
                checksLineComplete ? ` ${styles.routeCardStatComplete}` : ""
              }`}
            >
              Checks:{" "}
              <span className={styles.routeCardStatEm}>
                {cDone}/{cTot} completed
              </span>
            </p>
          </div>
        ) : (
          <div className={styles.routeCardStats}>
            <p
              className={`${styles.routeCardStat}${
                guestsLineComplete ? ` ${styles.routeCardStatComplete}` : ""
              }`}
            >
              Guests:{" "}
              <span className={styles.routeCardStatEm}>
                {gDone}/{gTot} completed
              </span>
            </p>
          </div>
        )}
        {wipChips.length > 0 ? (
          <div className={styles.routeCardWipRow} aria-label="In progress">
            {wipChips.map((c) => (
              <span key={c.key} className={styles.routeWipChip}>
                {c.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
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
    turnover: {
      guestTotal: 0,
      guestCompleted: 0,
      guestInProgress: 0,
      checkTotal: 0,
      checkCompleted: 0,
      checkInProgress: 0,
    },
    midweek: {
      guestTotal: 0,
      guestCompleted: 0,
      guestInProgress: 0,
      checkTotal: 0,
      checkCompleted: 0,
      checkInProgress: 0,
    },
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
          guestInProgress: turnover.guestInProgress,
          checkTotal: turnover.checkTotal,
          checkCompleted: turnover.checkCompleted,
          checkInProgress: turnover.checkInProgress,
        },
        midweek: {
          guestTotal: midweek.guestTotal,
          guestCompleted: midweek.guestCompleted,
          guestInProgress: midweek.guestInProgress,
          checkTotal: midweek.checkTotal,
          checkCompleted: midweek.checkCompleted,
          checkInProgress: midweek.checkInProgress,
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
    <SubpageTemplate
      title={technician.name ?? formatTechnicianSlugForDisplay(technician.slug)}
      backTo="/technicians"
      readableDarkText
    >
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
