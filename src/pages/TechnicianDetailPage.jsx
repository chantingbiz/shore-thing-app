import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import RouteSheetUploadPanel from "../components/RouteSheetUploadPanel.jsx";
import { getPropertiesForTechnician } from "../lib/api.js";
import { getTechnicianBySlug } from "../data/technicians.js";
import SubpageTemplate from "./SubpageTemplate.jsx";
import styles from "./TechnicianDetailPage.module.css";

export default function TechnicianDetailPage() {
  const { slug } = useParams();
  const technician = getTechnicianBySlug(slug);
  const techSlug = (technician?.slug ?? "").toLowerCase();
  const [routeProps, setRouteProps] = useState([]);

  const loadRouteProps = useCallback(async () => {
    if (!techSlug) return;
    try {
      const rows = await getPropertiesForTechnician(techSlug);
      setRouteProps(rows);
    } catch (e) {
      console.error(e);
      setRouteProps([]);
    }
  }, [techSlug]);

  useEffect(() => {
    void loadRouteProps();
  }, [loadRouteProps]);

  if (!technician) {
    return <Navigate to="/technicians" replace />;
  }

  return (
    <SubpageTemplate title={technician.name} backTo="/technicians">
      <RouteSheetUploadPanel
        technicianSlug={techSlug}
        routeCountHint={routeProps.length}
        onApplied={() => void loadRouteProps()}
      />
      {routeProps.length > 0 ? (
        <section className={styles.routeList} aria-label="Properties on your route">
          <h2 className={styles.routeListTitle}>Your route ({routeProps.length})</h2>
          <ul className={styles.routeUl}>
            {routeProps.map((p) => (
              <li key={p.id} className={styles.routeLi}>
                <span className={styles.routeName}>{p.name}</span>
                <span className={styles.routeAddr}>{p.address}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </SubpageTemplate>
  );
}
