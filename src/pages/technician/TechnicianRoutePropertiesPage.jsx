import { useParams } from "react-router-dom";
import StephenRoutePropertyList from "../stephen/StephenRoutePropertyList.jsx";
import SubpageTemplate from "../SubpageTemplate.jsx";
import { getTechnicianBySlug } from "../../data/technicians.js";
import { formatTechnicianSlugForDisplay } from "../../utils/technicianDisplay.js";
import styles from "./TechnicianRoutePropertiesPage.module.css";

/**
 * Route-type property list entry point for any technician.
 * Stephen: list from sent `route_sheet_items` (see StephenRoutePropertyList).
 * Others: placeholder until turnover/midweek lists are loaded from Supabase.
 *
 * @param {{ routeType: import('../../data/technicianRouteSheetsMock.js').TechnicianRouteType }} props
 */
export default function TechnicianRoutePropertiesPage({ routeType }) {
  const { slug } = useParams();
  const techSlug = (slug ?? "").toLowerCase();
  const technician = getTechnicianBySlug(techSlug);

  if (!technician) {
    return null;
  }

  if (techSlug === "stephen") {
    return <StephenRoutePropertyList routeType={routeType} />;
  }

  const label = routeType === "turnover" ? "Turnover" : "Midweek";

  return (
    <SubpageTemplate
      title={`${
        technician.name ?? formatTechnicianSlugForDisplay(technician.slug)
      } · ${label}`}
      backTo={`/technician/${techSlug}`}
      readableDarkText
    >
      <p className={styles.placeholder}>
        No properties on this route yet. When wired,{" "}
        <strong>{label}</strong> assignments will load from Supabase (separate from the other route
        sheet).
      </p>
    </SubpageTemplate>
  );
}
