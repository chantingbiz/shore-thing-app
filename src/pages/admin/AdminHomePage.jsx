import { useState } from "react";
import { Link } from "react-router-dom";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import { supabase } from "../../lib/supabaseClient.js";
import { resetSupabaseCaches } from "../../lib/supabaseStore.js";

export default function AdminHomePage() {
  const [resetStatus, setResetStatus] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);

  const handleReset = async () => {
    const ok = window.confirm(
      "Reset App Data?\n\nThis will clear stored app data from Supabase (service logs, activity logs, route settings).\nThis does NOT delete properties.\n\nPress OK to run the reset."
    );
    if (!ok) return;

    try {
      setResetBusy(true);
      setResetStatus(null);
      const { data, error } = await supabase.rpc("reset_shore_thing_data");
      if (error) {
        console.error("Supabase write failed", error);
        setResetStatus({ kind: "error", message: "Reset failed. See console." });
        return;
      }
      console.log("Supabase write ok", data);
      resetSupabaseCaches();
      setResetStatus({ kind: "ok", message: "App data reset successfully." });
    } catch (error) {
      console.error("Supabase write failed", error);
      setResetStatus({ kind: "error", message: "Reset failed. See console." });
    } finally {
      setResetBusy(false);
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
          className={`${glass.glassBtn} ${glass.glassBtnFull}`}
        >
          <span className={glass.btnLabel}>Today&apos;s Activity</span>
        </Link>
        <Link
          to="/administrator/routes"
          className={`${glass.glassBtn} ${glass.glassBtnFull}`}
        >
          <span className={glass.btnLabel}>Adjust Routes</span>
        </Link>
      </nav>

      <div style={{ marginTop: "1.25rem" }} aria-label="Danger zone">
        <button
          type="button"
          className={`${glass.glassBtn} ${glass.glassBtnFull}`}
          onClick={handleReset}
          disabled={resetBusy}
          style={{
            background: "rgba(255, 60, 60, 0.18)",
            border: "1px solid rgba(255, 120, 120, 0.45)",
          }}
        >
          <span className={glass.btnLabel}>
            {resetBusy ? "Resetting…" : "Reset App Data"}
          </span>
        </button>
        {resetStatus ? (
          <p className={styles.placeholderNote} style={{ marginTop: "0.6rem" }}>
            {resetStatus.message}
          </p>
        ) : null}
      </div>
    </SubpageTemplate>
  );
}
