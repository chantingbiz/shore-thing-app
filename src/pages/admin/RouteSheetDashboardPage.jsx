import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import SubpageTemplate from "../SubpageTemplate.jsx";
import { archiveCompletedServiceLogs, getTodayEasternDate } from "../../lib/api.js";
import { resetSupabaseCaches } from "../../lib/supabaseStore.js";
import styles from "./RouteSheetDashboardPage.module.css";
import {
  ROUTE_CALENDAR_DAYS,
  ROUTE_SHEET_TYPES,
  ROUTE_SHEET_TECHNICIANS,
  MOCK_ROUTE_PROPERTIES,
  isActiveOnDay,
  defaultIncludedOnSheet,
  inclusionStorageKey,
  sheetTypeForCalendarDay,
  isWeekdayDispatch,
} from "./routeSheetDashboardMock.js";

/**
 * Future: per technician + sheet type (turnover | midweek) when no sheet is needed.
 * null = not wired; when set, use false to dim rows in the status panel.
 * @type {{ [techSlug: string]: Partial<Record<'turnover' | 'midweek', boolean>> } | null}
 */
const TECHNICIAN_NEEDS_SHEET_PLACEHOLDER = null;

function techDisplayName(slug) {
  return ROUTE_SHEET_TECHNICIANS.find((t) => t.slug === slug)?.name ?? slug;
}

function rowVisualClass(prop, dayKey, included) {
  if (!isWeekdayDispatch(dayKey)) return styles.rowActive;
  if (prop.serviceType === "guest") return styles.rowActive;
  if (included) return styles.rowManual;
  return styles.rowMuted;
}

function isBothSheetTypesSent(sentMap, slug) {
  return !!(sentMap[`${slug}::turnover`] && sentMap[`${slug}::midweek`]);
}

/** Default calendar day when opening a route from the status panel. */
function defaultDayKeyForSheetType(typeKey) {
  return typeKey === "turnover" ? "saturday" : "monday";
}

/** Pending-queue default: Turnover first until sent, then Midweek. */
function defaultSheetTypeForTechnician(sentMap, slug) {
  return sentMap[`${slug}::turnover`] ? "midweek" : "turnover";
}

/**
 * Sheets to show in the archive preview (consolidated labels).
 * Temporary rule: any technician+type marked sent in local `sentMap` counts as ready to preview-archive.
 * Swap this for real eligibility (e.g. Supabase) when wired.
 */
function getArchivePreviewFromSentMap(sentMap) {
  const rows = [];
  for (const t of ROUTE_SHEET_TECHNICIANS) {
    for (const st of ROUTE_SHEET_TYPES) {
      const key = `${t.slug}::${st.key}`;
      if (!sentMap[key]) continue;
      rows.push({ key, label: `${t.name} ${st.label}` });
    }
  }
  return rows;
}

/** Auto-growing comments field; height follows content (no inner scroll). */
function RowCommentsTextarea({ value, onChange, ariaLabel }) {
  const taRef = useRef(null);
  const syncHeight = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={taRef}
      className={styles.commentsTextarea}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      placeholder="—"
    />
  );
}

/** @typedef {{ serviceType?: 'guest' | 'check', poolHeat?: boolean, comments?: string }} PropertyEditPatch */

export default function RouteSheetDashboardPage() {
  const [technicianSlug, setTechnicianSlug] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [includedOverrides, setIncludedOverrides] = useState(() => ({}));
  const [sentMap, setSentMap] = useState(() => ({}));
  /** Local row overrides; mock stays source of truth for filter fields. */
  const [propertyEdits, setPropertyEdits] = useState(() => (/** @type {Record<string, PropertyEditPatch>} */ ({})));
  /** Explicit Turnover vs Midweek for send/review (kept in sync with calendar day). */
  const [activeSheetType, setActiveSheetType] = useState(/** @type {'turnover' | 'midweek'} */ ("turnover"));
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState(/** @type {{ kind: 'ok' | 'error', message: string } | null} */ (null));

  const hasTechnician = Boolean(technicianSlug);
  const hasDay = Boolean(dayKey);
  const workflowReady = hasTechnician && hasDay;
  const sentKey =
    hasTechnician && hasDay ? `${technicianSlug}::${activeSheetType}` : "";

  useEffect(() => {
    if (!dayKey || !technicianSlug) return;
    setActiveSheetType(sheetTypeForCalendarDay(dayKey));
  }, [dayKey, technicianSlug]);

  useEffect(() => {
    if (!technicianSlug) setActiveSheetType("turnover");
  }, [technicianSlug]);

  const filteredProperties = useMemo(() => {
    if (!technicianSlug || !dayKey) return [];
    return MOCK_ROUTE_PROPERTIES.filter(
      (p) => p.technicianSlug === technicianSlug && isActiveOnDay(p, dayKey)
    );
  }, [technicianSlug, dayKey]);

  const getEffectiveProperty = useCallback(
    (propId) => {
      const base = MOCK_ROUTE_PROPERTIES.find((p) => p.id === propId);
      if (!base) return null;
      const e = propertyEdits[propId];
      if (!e) return base;
      return {
        ...base,
        serviceType: e.serviceType ?? base.serviceType,
        poolHeat: e.poolHeat ?? base.poolHeat,
        comments: e.comments !== undefined ? e.comments : (base.comments ?? ""),
      };
    },
    [propertyEdits]
  );

  const isPropertyRowEdited = useCallback(
    (propId) => {
      const base = MOCK_ROUTE_PROPERTIES.find((p) => p.id === propId);
      const row = getEffectiveProperty(propId);
      if (!base || !row) return false;
      return (
        row.serviceType !== base.serviceType ||
        row.poolHeat !== base.poolHeat ||
        row.comments !== (base.comments ?? "")
      );
    },
    [getEffectiveProperty]
  );

  const patchProperty = (propId, /** @type {PropertyEditPatch} */ partial) => {
    setPropertyEdits((prev) => ({
      ...prev,
      [propId]: { ...prev[propId], ...partial },
    }));
  };

  const getIncluded = useCallback(
    (propId) => {
      const key = inclusionStorageKey(propId, dayKey);
      if (Object.prototype.hasOwnProperty.call(includedOverrides, key)) {
        return includedOverrides[key];
      }
      const prop = getEffectiveProperty(propId);
      if (!prop) return true;
      return defaultIncludedOnSheet(prop, dayKey);
    },
    [includedOverrides, dayKey, getEffectiveProperty]
  );

  const setIncluded = (propId, next) => {
    const key = inclusionStorageKey(propId, dayKey);
    setIncludedOverrides((prev) => ({ ...prev, [key]: next }));
  };

  const canSend = workflowReady;
  const dayLabel = ROUTE_CALENDAR_DAYS.find((d) => d.key === dayKey)?.label ?? "";
  const techName = technicianSlug ? techDisplayName(technicianSlug) : "";
  const sheetTypeLabel =
    activeSheetType === "turnover" ? "Turnover" : activeSheetType === "midweek" ? "Midweek" : "";

  const selectPendingTechnician = (slug) => {
    setTechnicianSlug(slug);
    if (!dayKey) {
      setActiveSheetType(defaultSheetTypeForTechnician(sentMap, slug));
    }
  };

  const applySheetTypeFromStep3 = (typeKey) => {
    setActiveSheetType(typeKey);
    setDayKey(defaultDayKeyForSheetType(typeKey));
  };

  const handleSend = () => {
    if (!canSend || !technicianSlug || !activeSheetType) return;
    const slug = technicianSlug;
    const typeKey = activeSheetType;
    const mapKey = `${slug}::${typeKey}`;

    const turnoverWas = !!sentMap[`${slug}::turnover`];
    const midweekWas = !!sentMap[`${slug}::midweek`];
    const turnoverNow = typeKey === "turnover" ? true : turnoverWas;
    const midweekNow = typeKey === "midweek" ? true : midweekWas;

    setSentMap((prev) => ({ ...prev, [mapKey]: true }));

    if (turnoverNow && midweekNow) {
      setTechnicianSlug("");
      setDayKey("");
      setActiveSheetType("turnover");
      return;
    }

    if (typeKey === "turnover" && !midweekNow) {
      setActiveSheetType("midweek");
      setDayKey(defaultDayKeyForSheetType("midweek"));
      return;
    }
  };

  const needsSheet = (slug, typeKey) => {
    if (!TECHNICIAN_NEEDS_SHEET_PLACEHOLDER) return true;
    const row = TECHNICIAN_NEEDS_SHEET_PLACEHOLDER[slug];
    if (!row) return true;
    return row[typeKey] !== false;
  };

  const pendingTechnicians = useMemo(
    () => ROUTE_SHEET_TECHNICIANS.filter((t) => !isBothSheetTypesSent(sentMap, t.slug)),
    [sentMap]
  );

  const archivePreviewSheets = useMemo(() => getArchivePreviewFromSentMap(sentMap), [sentMap]);
  const canArchive = archivePreviewSheets.length > 0 && !archiveBusy;

  const openRouteFromStatus = (slug, typeKey) => {
    setTechnicianSlug(slug);
    setActiveSheetType(typeKey);
    setDayKey(defaultDayKeyForSheetType(typeKey));
  };

  const handleArchive = async () => {
    if (archivePreviewSheets.length === 0) return;
    const sheetKeys = archivePreviewSheets.map((s) => s.key);
    const labelSummary = archivePreviewSheets.map((s) => s.label).join(", ");
    const ok = window.confirm(
      "Archive completed jobs for today?\n\n" +
        `Sheets marked sent (this session): ${labelSummary}\n\n` +
        "Completed visits are saved to service history, then removed from today’s live list. " +
        "Incomplete jobs are not affected."
    );
    if (!ok) return;
    try {
      setArchiveBusy(true);
      setArchiveStatus(null);
      const today = getTodayEasternDate();
      const result = await archiveCompletedServiceLogs(today);
      const inserted =
        result && typeof result === "object" && "inserted" in result ? result.inserted : result;
      const delSl =
        result && typeof result === "object" && "deleted_service_logs" in result
          ? result.deleted_service_logs
          : null;
      const delAct =
        result && typeof result === "object" && "deleted_activity_logs" in result
          ? result.deleted_activity_logs
          : null;
      resetSupabaseCaches();
      setSentMap((prev) => {
        const next = { ...prev };
        for (const k of sheetKeys) delete next[k];
        return next;
      });
      setArchiveStatus({
        kind: "ok",
        message:
          `Archived. New history rows: ${inserted ?? "—"}.` +
          (delSl != null && delAct != null
            ? ` Cleared ${delSl} live service log(s) and ${delAct} activity event(s).`
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

  const isStatusRowActive = (slug, typeKey) =>
    hasTechnician && hasDay && technicianSlug === slug && activeSheetType === typeKey;

  const step1Focus = !hasTechnician;
  const step2Focus = hasTechnician && !hasDay;
  const step3Focus = workflowReady;

  return (
    <SubpageTemplate
      title="Route Sheet Dashboard"
      subtitle="Dispatcher workflow: choose technician and day, review properties, then send sheet (mock — Supabase later)."
      backTo="/administrator"
      readableDarkText
      wideLayout
    >
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Work through each step: choose technician, choose day for the outgoing sheet, review properties, then send
          sheet.
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Dispatch</h2>

            <div
              className={`${styles.workflowBlock} ${step1Focus ? styles.workflowFocus : styles.workflowDone}`}
            >
              <p
                className={`${styles.stepCue} ${step1Focus ? styles.stepCuePulse : ""}`}
              >
                Step 1: Choose technician
              </p>
              <div className={styles.segmentRow}>
                {pendingTechnicians.length === 0 ? (
                  <p className={styles.queueEmpty}>
                    {hasTechnician ? (
                      <>
                        Queue complete — you&apos;re viewing <strong>{techName}</strong>. Use{" "}
                        <strong>Weekly Sheet Status</strong> to switch technician or route type.
                      </>
                    ) : (
                      <>
                        All technicians have had Turnover and Midweek sheets sent. Use{" "}
                        <strong>Weekly Sheet Status</strong> to reopen a route for review or edits.
                      </>
                    )}
                  </p>
                ) : (
                  pendingTechnicians.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      className={`${styles.segmentBtn} ${technicianSlug === t.slug ? styles.workflowSelectActive : ""}`}
                      onClick={() => selectPendingTechnician(t.slug)}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div
              className={`${styles.workflowBlock} ${!hasTechnician ? styles.workflowLocked : step2Focus ? styles.workflowFocus : styles.workflowDone}`}
            >
              <p
                className={`${styles.stepCue} ${step2Focus ? styles.stepCuePulse : ""}`}
              >
                Step 2: Choose day
              </p>
              <p className={styles.stepHelp}>
                Calendar day for this outgoing sheet (Sat/Sun count as Turnover; Mon–Fri as Midweek for status).
              </p>
              <div className={styles.segmentRow}>
                <span className={styles.segmentLabel}>Day</span>
                <div className={styles.dayChips}>
                  {ROUTE_CALENDAR_DAYS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      className={`${styles.segmentBtn} ${dayKey === d.key ? styles.workflowSelectActive : ""}`}
                      onClick={() => setDayKey(d.key)}
                      disabled={!hasTechnician}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`${styles.workflowBlock} ${!workflowReady ? styles.workflowLocked : step3Focus ? styles.workflowFocus : ""}`}
            >
              <p
                className={`${styles.stepCue} ${step3Focus ? styles.stepCuePulse : ""}`}
              >
                Step 3: Review properties and send sheet
              </p>
              <p className={styles.stepHelp}>
                Turnover / Midweek here matches what you send; switching type moves the day to Saturday or Monday.
              </p>
              <div className={styles.sheetTypeRow}>
                <span className={styles.segmentLabel}>Sheet type</span>
                <div className={styles.cellSeg} role="group" aria-label="Sheet type">
                  <button
                    type="button"
                    className={`${styles.cellSegBtn} ${activeSheetType === "turnover" ? styles.workflowSelectActive : styles.cellSegBtnOff}`}
                    onClick={() => applySheetTypeFromStep3("turnover")}
                  >
                    Turnover
                  </button>
                  <button
                    type="button"
                    className={`${styles.cellSegBtn} ${activeSheetType === "midweek" ? styles.workflowSelectActive : styles.cellSegBtnOff}`}
                    onClick={() => applySheetTypeFromStep3("midweek")}
                  >
                    Midweek
                  </button>
                </div>
              </div>
              <div className={styles.sendZone}>
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={!canSend}
                  onClick={handleSend}
                >
                  {canSend
                    ? `Send ${sheetTypeLabel} Sheet to ${techName}`
                    : "Choose technician and day to continue"}
                </button>
                <p className={styles.sendHint}>
                  {canSend && sentMap[sentKey]
                    ? `Marked ${sheetTypeLabel} sheet as sent for ${techName} (local only).`
                    : canSend
                      ? "Send sheet is simulated — only local state updates."
                      : "Choose technician and day to send sheet."}
                </p>
              </div>
            </div>
          </section>

          <section
            className={`${styles.panel} ${!workflowReady ? styles.panelLocked : styles.panelActive}`}
          >
            <h2 className={styles.panelTitle}>Property list</h2>
            {!workflowReady ? (
              <p className={`${styles.emptyPrompt} ${styles.emptyPromptMuted}`}>
                Choose technician and day to review properties.
              </p>
            ) : filteredProperties.length === 0 ? (
              <p className={styles.emptyPrompt}>
                No properties on file for {techName} on {dayLabel} (mock data).
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Property name</th>
                      <th>Address</th>
                      <th>Service type</th>
                      <th>Pool heat</th>
                      <th>Comments</th>
                      <th>Active / included</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProperties.map((prop) => {
                      const row = getEffectiveProperty(prop.id);
                      if (!row) return null;
                      const included = getIncluded(prop.id);
                      const rowClass = [
                        rowVisualClass(row, dayKey, included),
                        !included ? styles.rowExcluded : null,
                        isPropertyRowEdited(prop.id) ? styles.rowEdited : null,
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <tr key={prop.id} className={rowClass}>
                          <td
                            className={styles.propName}
                            title={isPropertyRowEdited(prop.id) ? "Row differs from mock defaults" : undefined}
                          >
                            {row.propertyName}
                          </td>
                          <td className={styles.addr}>{row.address}</td>
                          <td>
                            <div className={styles.cellSeg} role="group" aria-label="Service type">
                              <button
                                type="button"
                                className={`${styles.cellSegBtn} ${row.serviceType === "guest" ? styles.cellSegBtnGuestOn : styles.cellSegBtnOff}`}
                                onClick={() => patchProperty(prop.id, { serviceType: "guest" })}
                              >
                                Guest
                              </button>
                              <button
                                type="button"
                                className={`${styles.cellSegBtn} ${row.serviceType === "check" ? styles.cellSegBtnCheckOn : styles.cellSegBtnOff}`}
                                onClick={() => patchProperty(prop.id, { serviceType: "check" })}
                              >
                                Check
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className={styles.cellSeg} role="group" aria-label="Pool heat">
                              <button
                                type="button"
                                className={`${styles.cellSegBtn} ${row.poolHeat ? styles.cellSegBtnHeatYesOn : styles.cellSegBtnOff}`}
                                onClick={() => patchProperty(prop.id, { poolHeat: true })}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className={`${styles.cellSegBtn} ${!row.poolHeat ? styles.cellSegBtnHeatNoOn : styles.cellSegBtnOff}`}
                                onClick={() => patchProperty(prop.id, { poolHeat: false })}
                              >
                                No
                              </button>
                            </div>
                          </td>
                          <td className={styles.comments}>
                            <RowCommentsTextarea
                              value={row.comments}
                              onChange={(next) => patchProperty(prop.id, { comments: next })}
                              ariaLabel={`Comments, ${row.propertyName}`}
                            />
                          </td>
                          <td>
                            <label className={styles.toggle}>
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={(e) => setIncluded(prop.id, e.target.checked)}
                              />
                              <span>Include</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className={styles.asideColumn}>
          <aside className={styles.panel}>
            <h2 className={styles.panelTitle}>Weekly sheet status</h2>
            <p className={styles.asideIntro}>
              Turnover and Midweek per technician — sent state is not per calendar day. Click a row to open that
              technician and route (Saturday for Turnover, Monday for Midweek by default).
            </p>
            <div className={styles.statusList}>
              {ROUTE_SHEET_TECHNICIANS.map((t) =>
                ROUTE_SHEET_TYPES.map((st) => {
                  const key = `${t.slug}::${st.key}`;
                  const sent = !!sentMap[key];
                  const eligible = needsSheet(t.slug, st.key);
                  const active = isStatusRowActive(t.slug, st.key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.statusRow} ${styles.statusRowBtn} ${active ? styles.statusRowActive : ""}`}
                      style={eligible ? undefined : { opacity: 0.45 }}
                      onClick={() => openRouteFromStatus(t.slug, st.key)}
                    >
                      <span className={styles.statusLabel}>
                        {t.name} — {st.label}
                      </span>
                      <span className={`${styles.pill} ${sent ? styles.pillSent : styles.pillPending}`}>
                        {sent ? "Sent" : "Not sent"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <p className={styles.futureHint}>
              Future: dim rows when a technician no longer needs a sheet for that type (see{" "}
              <code>TECHNICIAN_NEEDS_SHEET_PLACEHOLDER</code>).
            </p>
          </aside>

          <aside className={styles.panel} aria-label="Archive completed services">
            <h2 className={styles.panelTitle}>Archive completed services</h2>
            <p className={styles.archiveIntro}>
              End-of-day: move completed visits into archived service history. Preview lists sheets you&apos;ve marked{" "}
              <strong>Sent</strong> in this dispatcher session.
            </p>
            {archivePreviewSheets.length > 0 ? (
              <ul className={styles.archivePreviewList}>
                {archivePreviewSheets.map((s) => (
                  <li key={s.key} className={styles.archivePreviewRow}>
                    <span className={styles.archivePreviewLabel}>{s.label}</span>
                    <span className={`${styles.pill} ${styles.pillSent}`}>Ready</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.archiveEmpty}>No completed sheets ready to archive.</p>
            )}
            <button
              type="button"
              className={styles.archiveActionBtn}
              disabled={!canArchive}
              onClick={() => void handleArchive()}
            >
              {archiveBusy ? "Archiving…" : "Archive completed services"}
            </button>
            {archiveStatus ? (
              <p
                className={
                  archiveStatus.kind === "error" ? styles.archiveStatusErr : styles.archiveStatusOk
                }
              >
                {archiveStatus.message}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </SubpageTemplate>
  );
}
