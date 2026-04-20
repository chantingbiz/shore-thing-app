import { Link } from "react-router-dom";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import homeStyles from "./AdminHomePage.module.css";

function IconActivity() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16M8 15l3-3 3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRoutes() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4c-2 3-6 4-6 9a6 6 0 0012 0c0-5-4-6-6-9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="2" fill="currentColor" />
    </svg>
  );
}

function IconIncident() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 7v6M12 17h.01M10.3 3h3.4l7 12-3.4 6H6.7l-3.4-6 7-12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCompletedSheets() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h12M8 12h12M8 18h8M4 6h.02M4 12h.02M4 18h.02"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 2v4M16 4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5A2.5 2.5 0 016.5 17H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminHomePage() {
  return (
    <SubpageTemplate title="Administrator" backTo="/" readableDarkText>
      <nav
        className={`${styles.list} ${styles.adminHomeNav}`}
        aria-label="Admin sections"
      >
        <div className={homeStyles.adminNavColumn}>
          <section
            className={homeStyles.featureSection}
            aria-labelledby="admin-mobile-features-title"
          >
            <h2 id="admin-mobile-features-title" className={homeStyles.sectionTitle}>
              Mobile Features
            </h2>
            <div className={homeStyles.sectionButtons}>
              <Link
                to="/administrator/activity"
                className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
              >
                <span className={homeStyles.navIcon}>
                  <IconActivity />
                </span>
                <span className={glass.btnLabel}>Today&apos;s Activity</span>
              </Link>
              <Link
                to="/administrator/completed-sheets"
                className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
              >
                <span className={homeStyles.navIcon}>
                  <IconCompletedSheets />
                </span>
                <span className={glass.btnLabel}>Completed Sheets</span>
              </Link>
              <Link
                to="/administrator/service-history"
                className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
              >
                <span className={homeStyles.navIcon}>
                  <IconHistory />
                </span>
                <span className={glass.btnLabel}>Search Properties</span>
              </Link>
            </div>
          </section>
          <section
            className={homeStyles.featureSection}
            aria-labelledby="admin-desktop-features-title"
          >
            <h2 id="admin-desktop-features-title" className={homeStyles.sectionTitle}>
              Desktop Features
            </h2>
            <div className={homeStyles.sectionButtons}>
              <Link
                to="/administrator/route-sheet-dashboard"
                className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
              >
                <span className={homeStyles.navIcon}>
                  <IconRoutes />
                </span>
                <span className={glass.btnLabel}>Route sheet dashboard</span>
              </Link>
              <Link
                to="/administrator/incident-report"
                className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
              >
                <span className={homeStyles.navIcon}>
                  <IconIncident />
                </span>
                <span className={glass.btnLabel}>Property incident report</span>
              </Link>
            </div>
          </section>
        </div>
      </nav>
    </SubpageTemplate>
  );
}
