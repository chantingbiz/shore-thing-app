import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getServiceRecordForPropertyDate,
  searchPropertiesForAdmin,
} from "../../lib/api.js";
import {
  midweekAfterPhotoUrl,
  midweekBeforePhotoUrl,
  normalizeIncidentServiceRow,
  turnoverAfterPhotoUrl,
} from "../../utils/incidentReportNormalize.js";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import pageStyles from "./PropertyIncidentReportPage.module.css";

/** Boss demo defaults — all editable in the UI. */
const DEFAULT_PROPERTY_SEARCH = "Whale Kept Secret";
const DEFAULT_TURNOVER_DATE = "2026-04-04";
const DEFAULT_MIDWEEK_DATE = "2026-04-08";

function formatCell(v) {
  if (v == null || String(v).trim() === "") return "—";
  return String(v);
}

function ReadingsTable({ water, workState }) {
  if (!workState) {
    return <p className={pageStyles.muted}>No readings on file.</p>;
  }
  const block = water === "pool" ? workState.pool : workState.spa;
  if (!block) {
    return <p className={pageStyles.muted}>No readings on file.</p>;
  }
  const rows =
    water === "pool"
      ? [
          ["tb", "TB"],
          ["fc", "FC"],
          ["ph", "pH"],
          ["ta", "TA"],
          ["poolTemp", "Temp"],
        ]
      : [
          ["tb", "TB"],
          ["fc", "FC"],
          ["ph", "pH"],
          ["ta", "TA"],
          ["spaTemp", "Temp"],
        ];
  const hasAny = rows.some(([key]) => {
    const cell = block[key];
    return (
      cell &&
      (String(cell.before ?? "").trim() !== "" || String(cell.after ?? "").trim() !== "")
    );
  });
  if (!hasAny) {
    return <p className={pageStyles.muted}>No readings recorded.</p>;
  }
  return (
    <table className={pageStyles.readings}>
      <thead>
        <tr>
          <th>Reading</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, label]) => {
          const cell = block[key];
          return (
            <tr key={key}>
              <td>{label}</td>
              <td>{formatCell(cell?.before)}</td>
              <td>{formatCell(cell?.after)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ChemList({ water, workState }) {
  if (!workState) return null;
  const chem = water === "pool" ? workState.poolChem : workState.spaChem;
  const items =
    water === "pool"
      ? [
          ["Pucks", chem.pucks],
          ["Granulated", chem.granulated],
          ["TA added", chem.ta],
          ...(String(chem?.clarifier ?? "").trim()
            ? [["Clarifier", `${String(chem.clarifier).trim()} bottle`]]
            : []),
        ]
      : [
          ["Mini pucks", chem.pucks],
          ["Granulated", chem.granulated],
          ["TA added", chem.ta],
        ];
  const out = items.filter(([, v]) => v != null && String(v).trim() !== "");
  if (!out.length) {
    return <p className={pageStyles.muted}>No chemicals added recorded.</p>;
  }
  return (
    <ul className={pageStyles.chemList}>
      {out.map(([label, v]) => (
        <li key={label}>
          {label}: {String(v)}
        </li>
      ))}
    </ul>
  );
}

function PhotoSlot({ label, url }) {
  return (
    <div className={pageStyles.photoWrap}>
      <p className={pageStyles.photoLab}>{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="" className={pageStyles.photo} />
        </a>
      ) : (
        <p className={pageStyles.photoEmpty}>No photo on file</p>
      )}
    </div>
  );
}

function sourceLabel(source) {
  if (source === "service_logs") return "Live log";
  if (source === "service_history") return "Archived history";
  return "—";
}

export default function PropertyIncidentReportPage() {
  const [searchText, setSearchText] = useState(DEFAULT_PROPERTY_SEARCH);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [defaultPropertyBusy, setDefaultPropertyBusy] = useState(true);

  const [water, setWater] = useState(/** @type {'pool' | 'spa'} */ ("spa"));
  const [turnoverDate, setTurnoverDate] = useState(DEFAULT_TURNOVER_DATE);
  const [midweekDate, setMidweekDate] = useState(DEFAULT_MIDWEEK_DATE);

  const [turnoverNorm, setTurnoverNorm] = useState(null);
  const [midweekNorm, setMidweekNorm] = useState(null);

  const [loadBusy, setLoadBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [midweekNote, setMidweekNote] = useState("");

  const runSearch = useCallback(async () => {
    setSearchBusy(true);
    try {
      const rows = await searchPropertiesForAdmin(searchText, 40);
      setSearchResults(rows);
    } catch (e) {
      console.error("property search failed", e);
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, [searchText]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await searchPropertiesForAdmin(DEFAULT_PROPERTY_SEARCH, 40);
        if (cancelled) return;
        setSearchResults(rows);
        const want = DEFAULT_PROPERTY_SEARCH.toLowerCase();
        const match =
          rows.find((r) => String(r.name ?? "").trim().toLowerCase() === want) ??
          rows.find((r) => String(r.name ?? "").toLowerCase().includes("whale")) ??
          rows[0] ??
          null;
        if (match) setSelected(match);
      } catch (e) {
        console.error("default property preload failed", e);
      } finally {
        if (!cancelled) setDefaultPropertyBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected?.id || !turnoverDate || !midweekDate) {
      setTurnoverNorm(null);
      setMidweekNorm(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadBusy(true);
      setLoadError(null);
      try {
        const [t, m] = await Promise.all([
          getServiceRecordForPropertyDate(selected.id, turnoverDate),
          getServiceRecordForPropertyDate(selected.id, midweekDate),
        ]);
        if (cancelled) return;
        setTurnoverNorm(t.row ? normalizeIncidentServiceRow(t.row, t.source) : null);
        setMidweekNorm(m.row ? normalizeIncidentServiceRow(m.row, m.source) : null);
      } catch (e) {
        console.error("incident report load failed", {
          message: e?.message,
          code: e?.code,
          details: e?.details,
          raw: e,
        });
        if (!cancelled) {
          setLoadError("Could not load service rows. See console for details.");
          setTurnoverNorm(null);
          setMidweekNorm(null);
        }
      } finally {
        if (!cancelled) setLoadBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, turnoverDate, midweekDate]);

  const propertyLine = selected
    ? [selected.name, selected.property_slug, selected.address].filter(Boolean).join(" · ")
    : "";

  return (
    <SubpageTemplate title="Property Incident Report" backTo="/administrator" readableDarkText>
      <div className={pageStyles.toolbar}>
        <p className={pageStyles.intro}>
          Gather spa or pool evidence for a guest complaint: pick a property, turnover and midweek service dates, then
          screenshot the report.
        </p>
      </div>

      <div className={pageStyles.controls}>
        <form
          className={pageStyles.row}
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <label className={pageStyles.labGrow}>
            Find property
            <input
              type="search"
              className={pageStyles.searchIn}
              placeholder="Name, slug, or address…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </label>
          <button type="submit" className={pageStyles.searchBtn} disabled={searchBusy || !searchText.trim()}>
            {searchBusy ? "Searching…" : "Search"}
          </button>
        </form>

        {searchResults.length > 0 ? (
          <ul className={pageStyles.results} aria-label="Search results">
            {searchResults.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${pageStyles.resultBtn} ${selected?.id === p.id ? pageStyles.resultBtnSelected : ""}`}
                  onClick={() => setSelected(p)}
                >
                  <strong>{p.name || p.property_slug}</strong>
                  {p.address ? <span> — {p.address}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {selected ? <p className={pageStyles.selectedPill}>Selected: {propertyLine}</p> : null}

        <div className={pageStyles.row} role="group" aria-label="Pool or spa">
          <span className={pageStyles.lab}>Report for</span>
          <div className={pageStyles.toggle}>
            <button
              type="button"
              className={`${pageStyles.toggleBtn} ${water === "pool" ? pageStyles.toggleBtnActive : ""}`}
              onClick={() => setWater("pool")}
            >
              Pool
            </button>
            <button
              type="button"
              className={`${pageStyles.toggleBtn} ${water === "spa" ? pageStyles.toggleBtnActive : ""}`}
              onClick={() => setWater("spa")}
            >
              Spa
            </button>
          </div>
        </div>

        <div className={pageStyles.row}>
          <label className={pageStyles.lab}>
            Turnover date
            <input
              type="date"
              className={pageStyles.dateIn}
              value={turnoverDate}
              onChange={(e) => setTurnoverDate(e.target.value)}
            />
          </label>
          <label className={pageStyles.lab}>
            Midweek date
            <input
              type="date"
              className={pageStyles.dateIn}
              value={midweekDate}
              onChange={(e) => setMidweekDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      {loadError ? <p className={pageStyles.err}>{loadError}</p> : null}
      {loadBusy ? <p className={pageStyles.loading}>Loading service rows…</p> : null}

      {selected && !loadBusy && !loadError ? (
        <section className={pageStyles.reportPaper} aria-label="Incident report output">
          <h2 className={pageStyles.reportTitle}>Property Incident Report</h2>
          <p className={pageStyles.meta}>
            <strong>{selected.name || selected.property_slug}</strong>
            {selected.property_slug ? <span> · {selected.property_slug}</span> : null}
            {selected.address ? <span> · {selected.address}</span> : null}
          </p>
          <p className={pageStyles.meta}>
            Body of water: <strong>{water === "pool" ? "Pool" : "Spa"}</strong>
          </p>

          <div className={pageStyles.section}>
            <div className={pageStyles.sectionHead}>
              <h3 className={pageStyles.sectionTitle}>Turnover</h3>
              <span className={pageStyles.meta}>{turnoverDate}</span>
              {turnoverNorm ? (
                <span className={pageStyles.sourceTag}>{sourceLabel(turnoverNorm.source)}</span>
              ) : null}
            </div>
            {!turnoverNorm ? (
              <p className={pageStyles.muted}>
                No service log or archived history row for this property on the turnover date.
              </p>
            ) : (
              <>
                <p className={pageStyles.meta}>
                  Technician: <strong>{turnoverNorm.technicianSlug || "—"}</strong>
                </p>
                <div className={pageStyles.photoRow}>
                  <PhotoSlot
                    label={water === "pool" ? "Pool · after" : "Spa · after"}
                    url={turnoverAfterPhotoUrl(water, turnoverNorm)}
                  />
                </div>
                <ReadingsTable water={water} workState={turnoverNorm.workState} />
                <p className={pageStyles.muted} style={{ marginTop: "0.5rem" }}>
                  Chemicals added
                </p>
                <ChemList water={water} workState={turnoverNorm.workState} />
              </>
            )}
          </div>

          <div className={pageStyles.section}>
            <div className={pageStyles.sectionHead}>
              <h3 className={pageStyles.sectionTitle}>Midweek</h3>
              <span className={pageStyles.meta}>{midweekDate}</span>
              {midweekNorm ? <span className={pageStyles.sourceTag}>{sourceLabel(midweekNorm.source)}</span> : null}
            </div>
            {!midweekNorm ? (
              <p className={pageStyles.muted}>
                No service log or archived history row for this property on the midweek date.
              </p>
            ) : (
              <>
                <p className={pageStyles.meta}>
                  Technician: <strong>{midweekNorm.technicianSlug || "—"}</strong>
                </p>
                <div className={pageStyles.photoRow}>
                  <PhotoSlot
                    label={water === "pool" ? "Pool · before" : "Spa · before"}
                    url={midweekBeforePhotoUrl(water, midweekNorm)}
                  />
                  <PhotoSlot
                    label={water === "pool" ? "Pool · after" : "Spa · after"}
                    url={midweekAfterPhotoUrl(water, midweekNorm)}
                  />
                </div>
                <ReadingsTable water={water} workState={midweekNorm.workState} />
                <p className={pageStyles.muted} style={{ marginTop: "0.5rem" }}>
                  Chemicals added
                </p>
                <ChemList water={water} workState={midweekNorm.workState} />
                <label className={pageStyles.lab} style={{ marginTop: "0.65rem" }}>
                  Quick note / technician observation
                  <textarea
                    className={pageStyles.noteArea}
                    value={midweekNote}
                    onChange={(e) => setMidweekNote(e.target.value)}
                    placeholder="Local draft only — not saved to the server yet."
                  />
                </label>
                <p className={pageStyles.noteHint}>This note stays in your browser until you add persistence.</p>
              </>
            )}
          </div>
        </section>
      ) : null}

      {defaultPropertyBusy ? (
        <p className={pageStyles.placeholderNote}>Loading default property…</p>
      ) : !selected ? (
        <p className={pageStyles.placeholderNote}>Search and select a property to build the report.</p>
      ) : null}

      <Link
        to="/administrator"
        className={`${glass.glassBtn} ${glass.glassBtnFull}`}
        style={{ marginTop: "1rem" }}
      >
        <span className={glass.btnLabel}>Back to admin home</span>
      </Link>
    </SubpageTemplate>
  );
}
