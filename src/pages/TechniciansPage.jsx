import { Link } from "react-router-dom";
import { TECHNICIANS, getTechnicianBySlug } from "../data/technicians.js";
import { formatTechnicianSlugForDisplay } from "../utils/technicianDisplay.js";
import glass from "../styles/glassButtons.module.css";
import SubpageTemplate from "./SubpageTemplate.jsx";
import styles from "./TechniciansPage.module.css";

export default function TechniciansPage() {
  return (
    <SubpageTemplate title="Technicians" backTo="/">
      <nav className={styles.list} aria-label="Select technician">
        {TECHNICIANS.map(({ slug }) => (
          <Link
            key={slug}
            to={`/technician/${slug}`}
            className={`${glass.glassBtn} ${glass.glassBtnFull}`}
          >
            <span className={glass.btnLabel}>
              {getTechnicianBySlug(slug)?.name ?? formatTechnicianSlugForDisplay(slug)}
            </span>
          </Link>
        ))}
      </nav>
    </SubpageTemplate>
  );
}
