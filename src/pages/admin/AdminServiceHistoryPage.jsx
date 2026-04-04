import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getServiceHistoryRows } from "../../lib/api.js";
import { addGregorianDaysToYmd, getTodayEasternDate } from "../../lib/easternDate.js";
import { ensurePropertiesById, getPropertyById } from "../../lib/supabaseStore.js";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import histStyles from "./AdminServiceHistoryPage.module.css";

function daysAgoEastern(days) {
  return addGregorianDaysToYmd(getTodayEasternDate(), -days);
}

function activityCount(snapshot) {
  return Array.isArray(snapshot) ? snapshot.length : 0;
}

export default function AdminServiceHistoryPage() {
  const [startDate, setStartDate] = useState(() => daysAgoEastern(120));
  const [endDate, setEndDate] = useState(() => getTodayEasternDate());
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServiceHistoryRows({ startDate, endDate, limit: 500 });
      setRows(data);
      const ids = [...new Set(data.map((r) => r.property_id).filter(Boolean))];
      await ensurePropertiesById(ids);
    } catch (e) {
      console.error(e);
      setError("Could not load service_history. Run the SQL migration and check RLS/policies.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const prop = getPropertyById(r.property_id);
      const slug = (prop?.property_slug || "").toLowerCase();
      const name = (prop?.name || "").toLowerCase();
      const addr = (prop?.address || "").toLowerCase();
      return slug.includes(q) || name.includes(q) || addr.includes(q);
    });
  }, [rows, query]);

  return (
    <SubpageTemplate title="Archived service history" backTo="/administrator" readableDarkText>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Search archived copies of completed service logs (property + date). Activity snapshots are stored as JSON per row.
        </p>
        <button type="button" className={styles.refreshBtn} onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className={histStyles.filters}>
        <label className={histStyles.lab}>
          From
          <input
            type="date"
            className={histStyles.dateIn}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className={histStyles.lab}>
          To
          <input
            type="date"
            className={histStyles.dateIn}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className={histStyles.labGrow}>
          Property
          <input
            type="search"
            className={histStyles.searchIn}
            placeholder="Name, slug, or address…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className={histStyles.err}>{error}</p> : null}

      <ul className={histStyles.list}>
        {filtered.map((row) => {
          const prop = getPropertyById(row.property_id);
          const title = prop?.name || row.property_id;
          const sub = [prop?.property_slug, prop?.address].filter(Boolean).join(" · ");
          const photos = [
            row.pool_before_photo_url,
            row.pool_after_photo_url,
            row.spa_before_photo_url,
            row.spa_after_photo_url,
          ].filter(Boolean);
          return (
            <li key={row.id} className={histStyles.card}>
              <div className={histStyles.cardTop}>
                <div>
                  <div className={histStyles.cardTitle}>{title}</div>
                  <div className={histStyles.cardMeta}>
                    <span className={histStyles.pill}>{row.service_date}</span>
                    {sub ? <span className={histStyles.sub}>{sub}</span> : null}
                    <span className={histStyles.pillMuted}>
                      {activityCount(row.activity_snapshot)} activity events (snapshot)
                    </span>
                  </div>
                </div>
              </div>
              {photos.length ? (
                <div className={histStyles.thumbs}>
                  {photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className={histStyles.thumbA}>
                      <img src={url} alt="" className={histStyles.thumb} />
                    </a>
                  ))}
                </div>
              ) : null}
              <details className={histStyles.details}>
                <summary>Activity snapshot (JSON)</summary>
                <pre className={histStyles.pre}>{JSON.stringify(row.activity_snapshot ?? [], null, 2)}</pre>
              </details>
            </li>
          );
        })}
      </ul>

      {!loading && !filtered.length ? (
        <p className={styles.placeholderNote}>No archived rows in this range{query.trim() ? " (try clearing the property filter)" : ""}.</p>
      ) : null}

      <Link to="/administrator" className={`${glass.glassBtn} ${glass.glassBtnFull}`} style={{ marginTop: "1rem" }}>
        <span className={glass.btnLabel}>Back to admin home</span>
      </Link>
    </SubpageTemplate>
  );
}
