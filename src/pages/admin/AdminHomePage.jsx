import { useState } from "react";
import { Link } from "react-router-dom";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import homeStyles from "./AdminHomePage.module.css";
import { archiveCompletedServiceLogs, getTodayEasternDate } from "../../lib/api.js";
import { resetSupabaseCaches } from "../../lib/supabaseStore.js";

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

function IconArchive() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7zM2 4h20v3H2V4zM10 11h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminHomePage() {
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState(null);

  const handleArchive = async () => {
    const today = getTodayEasternDate();
    const ok = window.confirm(
      "Archive completed jobs for today?\n\n" +
        "Completed visits are saved to service history, then removed from today’s live list. " +
        "Incomplete jobs are not affected."
    );
    if (!ok) return;
    try {
      setArchiveBusy(true);
      setArchiveStatus(null);
      const result = await archiveCompletedServiceLogs(today);
      const inserted =
        result && typeof result === "object" && "inserted" in result
          ? result.inserted
          : result;
      const delSl =
        result && typeof result === "object" && "deleted_service_logs" in result
          ? result.deleted_service_logs
          : null;
      const delAct =
        result && typeof result === "object" && "deleted_activity_logs" in result
          ? result.deleted_activity_logs
          : null;
      resetSupabaseCaches();
      setArchiveStatus({
        kind: "ok",
        message:
          `Done. New history rows: ${inserted ?? "—"}.` +
          (delSl != null && delAct != null
            ? ` Cleared ${delSl} live service log(s) and ${delAct} activity event(s) for archived properties.`
            : ""),
      });
    } catch (error) {
      console.error("archive failed", error);
      setArchiveStatus({
        kind: "error",
        message: "Archive failed. Apply the latest SQL migration and check the console.",
      });
    } finally {
      setArchiveBusy(false);
    }
  };

  return (
    <SubpageTemplate title="Administrator" backTo="/" readableDarkText>
      <nav
        className={`${styles.list} ${styles.adminHomeNav}`}
        aria-label="Admin sections"
      >
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
          to="/administrator/routes"
          className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
        >
          <span className={homeStyles.navIcon}>
            <IconRoutes />
          </span>
          <span className={glass.btnLabel}>Adjust Routes</span>
        </Link>
        <Link
          to="/administrator/service-history"
          className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.navLink}`}
        >
          <span className={homeStyles.navIcon}>
            <IconHistory />
          </span>
          <span className={glass.btnLabel}>Archived service history</span>
        </Link>
      </nav>

      <div className={homeStyles.archiveSection} aria-label="Archive completed services">
        <p className={homeStyles.archiveHint}>
          Press at end of day to send completed service records to Archived Service History.
        </p>
        <button
          type="button"
          className={`${glass.glassBtn} ${glass.glassBtnFull} ${homeStyles.archiveBtnAccent}`}
          onClick={() => void handleArchive()}
          disabled={archiveBusy}
        >
          <span className={homeStyles.archiveBtnInner}>
            <span className={homeStyles.archiveIcon}>
              <IconArchive />
            </span>
            <span className={glass.btnLabel}>
              {archiveBusy ? "Archiving…" : "Archive completed services"}
            </span>
          </span>
        </button>
        {archiveStatus ? (
          <p className={styles.placeholderNote} style={{ marginTop: "0.65rem" }}>
            {archiveStatus.message}
          </p>
        ) : null}
      </div>
    </SubpageTemplate>
  );
}
