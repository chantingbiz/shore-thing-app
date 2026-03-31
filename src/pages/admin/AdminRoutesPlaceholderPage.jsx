import { Navigate, useParams } from "react-router-dom";
import { getTechnicianBySlug } from "../../data/technicians.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";

export default function AdminRoutesPlaceholderPage() {
  const { techSlug } = useParams();
  const tech = getTechnicianBySlug(techSlug);

  if (!tech) {
    return <Navigate to="/administrator/routes" replace />;
  }

  if (tech.slug === "stephen") {
    return <Navigate to="/administrator/routes/stephen" replace />;
  }

  return (
    <SubpageTemplate
      title={`${tech.name} — Routes`}
      backTo="/administrator/routes"
      readableDarkText
    >
      <p className={styles.placeholderNote}>
        Route adjustments for {tech.name} will be available in a future update.
        Only Stephen&apos;s route list is wired in this version.
      </p>
    </SubpageTemplate>
  );
}
