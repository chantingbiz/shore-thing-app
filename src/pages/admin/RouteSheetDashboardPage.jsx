import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import SubpageTemplate from "../SubpageTemplate.jsx";
import {
  archiveCompletedServiceLogs,
  getPropertiesForTechnician,
  getRouteSettings,
  getRouteSheetItemsForWeek,
  getRouteSheetWeekSentSnapshot,
  getTodayEasternDate,
  ROUTE_SHEET_ITEMS_ON_CONFLICT,
  upsertRouteSheetItemsBatch,
} from "../../lib/api.js";
import {
  calendarDateForRouteSheetDay,
  formatDayChipMd,
  getActiveRouteSheetSaturdayEastern,
  getRouteSheetWeekLabel,
} from "../../lib/routeSheetWeek.js";
import { resetSupabaseCaches } from "../../lib/supabaseStore.js";
import { isRouteSheetRowIncludedOnActiveSheet } from "../../utils/routeSheetSentGuestCheckSummary.js";
import styles from "./RouteSheetDashboardPage.module.css";
import {
  ROUTE_CALENDAR_DAYS,
  ROUTE_SHEET_TYPES,
  ROUTE_SHEET_TECHNICIANS,
  isActiveOnDay,
  defaultIncludedOnSheet,
  inclusionStorageKey,
  sheetTypeForCalendarDay,
  isWeekdayDispatch,
} from "./routeSheetDashboardMock.js";

/**
 * Seed rows: `properties` is authoritative list; `route_settings` merged by property_id.
 * `assignedTechnicianSlug` = dispatcher-selected technician (future vacation cover).
 * @param {Record<string, unknown>[]} propsList
 * @param {Record<string, unknown>[]} settingsRows
 * @param {string} assignedTechnicianSlugLower
 */
function mergePropertiesWithRouteSettings(propsList, settingsRows, assignedTechnicianSlugLower) {
  const settingsById = new Map(settingsRows.map((s) => [String(s.property_id), s]));
  return propsList.map((prop) => {
    const pid = String(prop.id);
    const s = settingsById.get(pid);
    const gc = s?.guest_check;
    const serviceType = gc === "guest" ? "guest" : "check";
    const ph = s?.pool_heat;
    const poolHeat = ph === "pool_heat" || ph === "heat";
    const sourceTechnicianSlug = String(prop.technician_slug ?? "").toLowerCase();
    return {
      id: pid,
      propertyName: String(s?.property_name ?? prop.name ?? "Property"),
      address: String(prop.address ?? ""),
      /** Legacy filter field: same as assigned for current workflow */
      technicianSlug: assignedTechnicianSlugLower,
      sourceTechnicianSlug,
      assignedTechnicianSlug: assignedTechnicianSlugLower,
      serviceType,
      poolHeat,
      comments: "",
      activeOnSaturday: true,
      activeOnSunday: true,
      activeOnMidweek: true,
    };
  });
}

/** @param {Record<string, unknown>} item @param {Record<string, unknown> | undefined} propertyRow */
function mapRouteSheetItemToDashboardRow(item, propertyRow) {
  const gc = item.guest_check;
  const serviceType = gc === "guest" ? "guest" : "check";
  const ph = item.pool_heat;
  const poolHeat = ph === "pool_heat" || ph === "heat";
  const assigned = String(
    item.assigned_technician_slug ?? item.technician_slug ?? ""
  ).toLowerCase();
  const source = String(
    item.source_technician_slug ?? propertyRow?.technician_slug ?? ""
  ).toLowerCase();
  return {
    id: String(item.property_id),
    propertyName: String(item.property_name || propertyRow?.name || "Property"),
    address: String(propertyRow?.address ?? ""),
    technicianSlug: assigned,
    sourceTechnicianSlug: source,
    assignedTechnicianSlug: assigned,
    serviceType,
    poolHeat,
    comments: item.comments != null ? String(item.comments) : "",
    activeOnSaturday: true,
    activeOnSunday: true,
    activeOnMidweek: true,
  };
}

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

function isBothSheetTypesSent(weekSentSnapshot, slug) {
  return !!(
    weekSentSnapshot[`${slug}::turnover`] && weekSentSnapshot[`${slug}::midweek`]
  );
}

/** Default calendar day when opening a route from the status panel or after auto-switch. */
function defaultDayKeyForSheetType(typeKey) {
  return typeKey === "turnover" ? "saturday" : "wednesday";
}

/** Pending-queue default: Turnover first until sent, then Midweek. */
function defaultSheetTypeForTechnician(weekSentSnapshot, slug) {
  return weekSentSnapshot[`${slug}::turnover`] ? "midweek" : "turnover";
}

/**
 * Sheets to show in the archive preview (consolidated labels).
 * Uses `route_sheet_items` sent snapshot for the active Saturday-based sheet week.
 */
function getArchivePreviewFromWeekSnapshot(weekSentSnapshot) {
  const rows = [];
  for (const t of ROUTE_SHEET_TECHNICIANS) {
    for (const st of ROUTE_SHEET_TYPES) {
      const key = `${t.slug}::${st.key}`;
      if (!weekSentSnapshot[key]) continue;
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
  /** Eastern Saturday anchor for `route_sheet_items.week_start_date` (Thursday 7 AM rollover). */
  const [weekStartDate] = useState(() => getActiveRouteSheetSaturdayEastern());
  const weekLabel = useMemo(() => getRouteSheetWeekLabel(weekStartDate), [weekStartDate]);

  /** Calendar `M/D` per day chip, anchored to the active route-sheet Saturday week. */
  const dayChipMdByKey = useMemo(() => {
    const out = {};
    for (const d of ROUTE_CALENDAR_DAYS) {
      const ymd = calendarDateForRouteSheetDay(weekStartDate, d.key);
      out[d.key] = formatDayChipMd(ymd);
    }
    return out;
  }, [weekStartDate]);
  const [technicianSlug, setTechnicianSlug] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [includedOverrides, setIncludedOverrides] = useState(() => ({}));
  /** Sent flags from `route_sheet_items` for this week (`${slug}::turnover` etc.). */
  const [weekSentSnapshot, setWeekSentSnapshot] = useState(() => (/** @type {Record<string, boolean>} */ ({})));
  /** Rows from `route_sheet_items` or seeded from `route_settings` + `properties` address. */
  const [sourceProperties, setSourceProperties] = useState(() => []);
  const [sheetLoadBusy, setSheetLoadBusy] = useState(false);
  const [sheetLoadError, setSheetLoadError] = useState(/** @type {string | null} */ (null));
  const [sendBusy, setSendBusy] = useState(false);
  const [sheetReloadNonce, setSheetReloadNonce] = useState(0);
  /** Local row overrides; DB-loaded row is baseline for filter fields. */
  const [propertyEdits, setPropertyEdits] = useState(() => (/** @type {Record<string, PropertyEditPatch>} */ ({})));
  /** Explicit Turnover vs Midweek for send/review (kept in sync with calendar day). */
  const [activeSheetType, setActiveSheetType] = useState(/** @type {'turnover' | 'midweek'} */ ("turnover"));
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState(/** @type {{ kind: 'ok' | 'error', message: string } | null} */ (null));

  const refreshWeekSnapshot = useCallback(async () => {
    try {
      const snap = await getRouteSheetWeekSentSnapshot(weekStartDate);
      setWeekSentSnapshot(snap);
      return snap;
    } catch (e) {
      console.error("[route sheet dashboard] week snapshot failed", e);
      return {};
    }
  }, [weekStartDate]);

  useEffect(() => {
    void refreshWeekSnapshot();
  }, [refreshWeekSnapshot]);

  useEffect(() => {
    if (!technicianSlug) {
      setSourceProperties([]);
      setPropertyEdits({});
      setIncludedOverrides({});
      setSheetLoadError(null);
      setSheetLoadBusy(false);
      return;
    }
    if (!dayKey) {
      setSourceProperties([]);
      setPropertyEdits({});
      setIncludedOverrides({});
      setSheetLoadBusy(false);
      setSheetLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setSheetLoadBusy(true);
      setSheetLoadError(null);
      try {
        /**
         * Midweek hydration order (same week + assigned technician):
         * A) Saved midweek rows in route_sheet_items (handled when `items.length > 0` below).
         * B) Else if midweek: saved turnover rows → source of truth for guest/check + default included.
         * C) Else: properties + route_settings merge (no turnover sheet yet for turnover, or midweek with no turnover).
         */
        const items = await getRouteSheetItemsForWeek(
          weekStartDate,
          activeSheetType,
          technicianSlug
        );
        const propsList = await getPropertiesForTechnician(technicianSlug);
        const addrById = new Map(propsList.map((p) => [String(p.id), p]));
        const slugLower = String(technicianSlug).toLowerCase();
        if (cancelled) return;
        if (items.length > 0) {
          if (import.meta.env.DEV) {
            console.log("[route sheet dashboard] hydrate: saved sheet rows", {
              source: "saved_route_sheet_items",
              route_type: activeSheetType,
              week_start_date: weekStartDate,
              assigned_technician_slug: slugLower,
              row_count: items.length,
            });
          }
          setSourceProperties(
            items.map((row) => mapRouteSheetItemToDashboardRow(row, addrById.get(String(row.property_id))))
          );
          const o = {};
          for (const item of items) {
            o[inclusionStorageKey(String(item.property_id), dayKey)] = !!item.included;
          }
          setIncludedOverrides(o);
        } else if (activeSheetType === "midweek") {
          const turnoverRows = await getRouteSheetItemsForWeek(
            weekStartDate,
            "turnover",
            technicianSlug
          );
          if (turnoverRows.length > 0) {
            const guestRows = turnoverRows.filter((r) => r.guest_check === "guest").length;
            const checkRows = turnoverRows.filter((r) => r.guest_check === "check").length;
            if (import.meta.env.DEV) {
              console.log("[route sheet dashboard] hydrate: midweek from turnover", {
                source: "saved_turnover_route_sheet_items",
                week_start_date: weekStartDate,
                assigned_technician_slug: slugLower,
                turnover_row_count: turnoverRows.length,
                guest_rows: guestRows,
                check_rows: checkRows,
              });
            }
            setSourceProperties(
              turnoverRows.map((row) =>
                mapRouteSheetItemToDashboardRow(row, addrById.get(String(row.property_id)))
              )
            );
            const o = {};
            for (const item of turnoverRows) {
              const isGuest = item.guest_check === "guest";
              o[inclusionStorageKey(String(item.property_id), dayKey)] = isGuest;
            }
            setIncludedOverrides(o);
          } else {
            const propertyIds = propsList.map((p) => p.id).filter(Boolean);
            const settingsRows = propertyIds.length ? await getRouteSettings(propertyIds) : [];
            const merged = mergePropertiesWithRouteSettings(propsList, settingsRows, slugLower);
            if (import.meta.env.DEV) {
              console.log("[route sheet dashboard] hydrate: midweek default seed (no turnover saved)", {
                source: "properties_plus_route_settings",
                merged_rows: merged.length,
              });
            }
            setSourceProperties(merged);
            setIncludedOverrides({});
          }
        } else {
          const propertyIds = propsList.map((p) => p.id).filter(Boolean);
          const settingsRows = propertyIds.length ? await getRouteSettings(propertyIds) : [];
          const merged = mergePropertiesWithRouteSettings(propsList, settingsRows, slugLower);
          if (import.meta.env.DEV) {
            console.log("[route sheet dashboard] hydrate: turnover default seed", {
              source: "properties_plus_route_settings",
              merged_rows: merged.length,
            });
          }
          setSourceProperties(merged);
          setIncludedOverrides({});
        }
        setPropertyEdits({});
      } catch (e) {
        console.error("[route sheet dashboard] sheet load failed", e);
        if (!cancelled) {
          setSheetLoadError(e?.message ? String(e.message) : String(e));
          setSourceProperties([]);
        }
      } finally {
        if (!cancelled) setSheetLoadBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [technicianSlug, activeSheetType, weekStartDate, sheetReloadNonce, dayKey]);

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
    const want = String(technicianSlug).toLowerCase();
    return sourceProperties.filter((p) => {
      const assigned = String(p.assignedTechnicianSlug ?? p.technicianSlug ?? "").toLowerCase();
      return assigned === want && isActiveOnDay(p, dayKey);
    });
  }, [technicianSlug, dayKey, sourceProperties]);

  const getEffectiveProperty = useCallback(
    (propId) => {
      const base = sourceProperties.find((p) => p.id === propId);
      if (!base) return null;
      const e = propertyEdits[propId];
      if (!e) return base;
      return {
        ...base,
        serviceType: e.serviceType ?? base.serviceType,
        poolHeat: e.poolHeat ?? base.poolHeat,
        comments: e.comments !== undefined ? e.comments : (base.comments ?? ""),
        sourceTechnicianSlug: base.sourceTechnicianSlug,
        assignedTechnicianSlug: base.assignedTechnicianSlug,
        technicianSlug: base.technicianSlug,
      };
    },
    [propertyEdits, sourceProperties]
  );

  const isPropertyRowEdited = useCallback(
    (propId) => {
      const base = sourceProperties.find((p) => p.id === propId);
      const row = getEffectiveProperty(propId);
      if (!base || !row) return false;
      return (
        row.serviceType !== base.serviceType ||
        row.poolHeat !== base.poolHeat ||
        row.comments !== (base.comments ?? "")
      );
    },
    [getEffectiveProperty, sourceProperties]
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

  const canSend =
    workflowReady &&
    filteredProperties.length > 0 &&
    !sheetLoadBusy &&
    !sheetLoadError;
  const dayLabel = ROUTE_CALENDAR_DAYS.find((d) => d.key === dayKey)?.label ?? "";
  const techName = technicianSlug ? techDisplayName(technicianSlug) : "";
  const sheetTypeLabel =
    activeSheetType === "turnover" ? "Turnover" : activeSheetType === "midweek" ? "Midweek" : "";

  const selectPendingTechnician = (slug) => {
    setTechnicianSlug(slug);
    if (!dayKey) {
      const st = defaultSheetTypeForTechnician(weekSentSnapshot, slug);
      setActiveSheetType(st);
      setDayKey(defaultDayKeyForSheetType(st));
    }
  };

  const applySheetTypeFromStep3 = (typeKey) => {
    setActiveSheetType(typeKey);
    setDayKey(defaultDayKeyForSheetType(typeKey));
  };

  const handleSend = async () => {
    if (!canSend || !technicianSlug || !activeSheetType || sendBusy) return;
    if (filteredProperties.length === 0) return;
    const slug = technicianSlug;
    const typeKey = activeSheetType;
    const sentAt = new Date().toISOString();
    const slugLower = String(slug).toLowerCase();
    /** Only persist rows the dispatcher sees in the property table (same as filtered list). */
    const rows = filteredProperties.map((prop) => {
      const row = getEffectiveProperty(prop.id);
      if (!row) return null;
      const included = getIncluded(prop.id);
      const sourceTech = String(row.sourceTechnicianSlug ?? prop.sourceTechnicianSlug ?? "").toLowerCase();
      return {
        week_start_date: weekStartDate,
        route_type: typeKey,
        property_id: prop.id,
        property_name: row.propertyName,
        source_technician_slug: sourceTech || slugLower,
        assigned_technician_slug: slugLower,
        technician_slug: slugLower,
        guest_check: row.serviceType,
        pool_heat: row.poolHeat ? "pool_heat" : "no_pool_heat",
        comments: row.comments ?? "",
        included,
        sent_at: sentAt,
      };
    }).filter(Boolean);
    const guestRowsAll = rows.filter((r) => r.guest_check === "guest").length;
    const checkRowsAll = rows.filter((r) => r.guest_check === "check").length;
    const guestIncluded = rows.filter(
      (r) => r.guest_check === "guest" && isRouteSheetRowIncludedOnActiveSheet(r)
    ).length;
    const checkIncluded = rows.filter(
      (r) => r.guest_check === "check" && isRouteSheetRowIncludedOnActiveSheet(r)
    ).length;
    const payloadAudit = rows.map((r) => ({
      property_id: r.property_id,
      property_name: r.property_name,
      guest_check: r.guest_check,
      included: r.included,
    }));
    console.log("[route sheet dashboard] send payload audit", {
      week_start_date: weekStartDate,
      route_type: typeKey,
      day_key: dayKey,
      assigned_technician_slug: slugLower,
      row_count: rows.length,
      guest_rows: guestRowsAll,
      check_rows: checkRowsAll,
      included_guest_rows: guestIncluded,
      included_check_rows: checkIncluded,
      rows: import.meta.env.DEV ? payloadAudit : "(enable dev build for per-row list)",
    });
    if (import.meta.env.DEV) {
      for (const line of payloadAudit) {
        console.log("[route sheet dashboard] send row", line);
      }
    }
    setSendBusy(true);
    try {
      console.log("[route sheet dashboard] send", {
        row_count: rows.length,
        onConflict: ROUTE_SHEET_ITEMS_ON_CONFLICT,
        week_start_date: weekStartDate,
        route_type: typeKey,
        assigned_technician_slug: slugLower,
      });
      const saved = await upsertRouteSheetItemsBatch(rows);
      console.log("[route sheet dashboard] send result", {
        requested: rows.length,
        returned_rows: saved?.length ?? 0,
      });
      if (rows.length > 0 && (saved?.length ?? 0) === 0) {
        console.warn(
          "[route sheet dashboard] upsert returned no rows — if the table is still empty, check RLS (INSERT denied) or that RETURNING is allowed; if rows exist, SELECT may be blocked by RLS."
        );
      }
      const snap = await refreshWeekSnapshot();
      setSheetReloadNonce((n) => n + 1);
      const turnoverNow = !!snap[`${slug}::turnover`];
      const midweekNow = !!snap[`${slug}::midweek`];

      if (turnoverNow && midweekNow) {
        setTechnicianSlug("");
        setDayKey("");
        setActiveSheetType("turnover");
        return;
      }

      if (typeKey === "turnover" && !midweekNow) {
        setActiveSheetType("midweek");
        setDayKey(defaultDayKeyForSheetType("midweek"));
      }
    } catch (e) {
      const msg = e?.message ? String(e.message) : String(e);
      const code = e?.code ? String(e.code) : "";
      console.error("[route sheet dashboard] send failed", { message: msg, code, raw: e });
      const rls = /row-level security|rls|policy/i.test(msg);
      window.alert(
        rls
          ? `Save blocked (likely RLS): ${msg}\n\nIn Supabase, add a policy on route_sheet_items allowing INSERT/UPDATE (and SELECT if you need returning rows) for your role, or sign in as an authenticated user before using the dashboard.`
          : msg
            ? `Save failed: ${msg}${code ? ` [${code}]` : ""}`
            : "Save failed. Open the console for details (unique index / onConflict mismatch is common if migrations were not applied)."
      );
    } finally {
      setSendBusy(false);
    }
  };

  const needsSheet = (slug, typeKey) => {
    if (!TECHNICIAN_NEEDS_SHEET_PLACEHOLDER) return true;
    const row = TECHNICIAN_NEEDS_SHEET_PLACEHOLDER[slug];
    if (!row) return true;
    return row[typeKey] !== false;
  };

  const pendingTechnicians = useMemo(
    () => ROUTE_SHEET_TECHNICIANS.filter((t) => !isBothSheetTypesSent(weekSentSnapshot, t.slug)),
    [weekSentSnapshot]
  );

  const archivePreviewSheets = useMemo(
    () => getArchivePreviewFromWeekSnapshot(weekSentSnapshot),
    [weekSentSnapshot]
  );
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
        `Sheets marked sent (${weekLabel}): ${labelSummary}\n\n` +
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
      void refreshWeekSnapshot();
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
      subtitle={weekLabel}
      backTo="/administrator"
      readableDarkText
      wideLayout
    >
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
                      className={`${styles.segmentBtn} ${styles.dayChipBtn} ${dayKey === d.key ? styles.workflowSelectActive : ""}`}
                      onClick={() => setDayKey(d.key)}
                      disabled={!hasTechnician}
                      aria-label={`${d.label} ${dayChipMdByKey[d.key] ?? ""}`.trim()}
                    >
                      <span className={styles.dayChipDate}>{dayChipMdByKey[d.key] ?? "—"}</span>
                      <span className={styles.dayChipName}>{d.label}</span>
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
                  disabled={!canSend || sendBusy}
                  onClick={() => void handleSend()}
                >
                  {sendBusy
                    ? "Sending…"
                    : canSend
                      ? `Send ${sheetTypeLabel} Sheet to ${techName}`
                      : "Choose technician and day to continue"}
                </button>
                <p className={styles.sendHint}>
                  {canSend && weekSentSnapshot[sentKey]
                    ? `${weekLabel}: ${sheetTypeLabel} sheet saved for ${techName} in Supabase.`
                    : canSend
                      ? "Sends route_sheet_items (properties + route_settings merge when no saved sheet yet)."
                      : "Choose technician and day; properties load from Supabase."}
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
            ) : sheetLoadBusy ? (
              <p className={styles.emptyPrompt}>Loading route sheet from Supabase…</p>
            ) : sheetLoadError ? (
              <p className={styles.emptyPrompt}>Could not load sheet: {sheetLoadError}</p>
            ) : sourceProperties.length === 0 ? (
              <p className={styles.emptyPrompt}>
                No properties in Supabase for technician <strong>{techName}</strong> (check{" "}
                <code>properties.technician_slug</code>).
              </p>
            ) : filteredProperties.length === 0 ? (
              <p className={styles.emptyPrompt}>
                No properties for {techName} on {dayLabel} with the current day filter (all loaded rows are inactive
                for this weekday).
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
                            title={isPropertyRowEdited(prop.id) ? "Row differs from saved defaults" : undefined}
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
                  const sent = !!weekSentSnapshot[key];
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
              End-of-day: move completed visits into archived service history. Preview lists route types marked{" "}
              <strong>Sent</strong> for {weekLabel}.
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
