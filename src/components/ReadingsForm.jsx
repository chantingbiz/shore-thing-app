import { useEffect, useRef, useState } from "react";
import styles from "./ReadingsForm.module.css";
import { workStateFromServiceLogRow } from "../lib/api.js";
import {
  registerWorkFlush,
  unregisterWorkFlush,
} from "../utils/workFlushRegistry.js";
import { poolClarifierUnitSuffix } from "../utils/poolClarifierDisplay.js";

const pair = () => ({ before: "", after: "" });

const emptyChem = () => ({
  pucks: "",
  granulated: "",
  ta: "",
});

const emptyPoolChem = () => ({
  ...emptyChem(),
  clarifier: "",
});

/** Default amount when pool clarifier is added — ounces in `service_logs.pool_clarifier`. */
const POOL_CLARIFIER_DEFAULT = "5";

/** TB / FC / pH / TA only — Temp is never autofilled. */
const NORMAL_READING_KEYS = ["tb", "fc", "ph", "ta"];
const NORMAL_READING_VALUES = {
  tb: "5",
  fc: "3",
  ph: "7.4",
  ta: "120",
};

function applyNormalReadingsColumn(prev, side) {
  const next = { ...prev };
  for (const key of NORMAL_READING_KEYS) {
    next[key] = { ...prev[key], [side]: NORMAL_READING_VALUES[key] };
  }
  return next;
}

const POOL_ROWS = [
  { key: "tb", label: "TB" },
  { key: "fc", label: "FC" },
  { key: "ph", label: "pH" },
  { key: "ta", label: "TA" },
  { key: "poolTemp", label: "Temp", setTo: true },
];

const SPA_ROWS = [
  { key: "tb", label: "TB" },
  { key: "fc", label: "FC" },
  { key: "ph", label: "pH" },
  { key: "ta", label: "TA" },
  { key: "spaTemp", label: "Spa Temp" },
];

const POOL_CHEMICAL_ROWS = [
  { key: "pucks", label: "Pucks", suffix: null },
  { key: "granulated", label: "Granulated", suffix: "scoops" },
  { key: "ta", label: "TA", suffix: "scoops" },
];

const SPA_CHEMICAL_ROWS = [
  { key: "pucks", label: "Mini Pucks", suffix: null },
  { key: "granulated", label: "Granulated", suffix: "scoops" },
  { key: "ta", label: "TA", suffix: "scoops" },
];

function ChemicalFieldRow({ id, label, value, onChange, suffix }) {
  return (
    <div className={styles.chemRow}>
      <label className={styles.chemLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.chemInputWrap}>
        <input
          id={id}
          className={styles.chemInput}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        {suffix ? (
          <span className={styles.chemSuffix} aria-hidden>
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChemicalsAddedFields({ idPrefix, values, onFieldChange, rows }) {
  return (
    <div className={styles.chemBlock}>
      {rows.map(({ key, label, suffix }) => (
        <ChemicalFieldRow
          key={key}
          id={`${idPrefix}-${key}`}
          label={label}
          value={values[key]}
          onChange={(v) => onFieldChange(key, v)}
          suffix={suffix}
        />
      ))}
    </div>
  );
}

function PoolClarifierControl({ idPrefix, clarifier, onAdd, onRemove }) {
  const trimmed = String(clarifier ?? "").trim();
  const active = trimmed.length > 0;
  const suffix = active ? poolClarifierUnitSuffix(trimmed) : "oz";

  if (!active) {
    return (
      <div className={styles.clarifierAddWrap}>
        <button
          type="button"
          className={styles.clarifierAddBtn}
          id={`${idPrefix}-clarifier-add`}
          onClick={onAdd}
        >
          Add Clarifier
        </button>
      </div>
    );
  }

  return (
    <div className={styles.chemRow}>
      <span className={styles.chemLabel} id={`${idPrefix}-clarifier-label`}>
        Clarifier
      </span>
      <div className={styles.clarifierActiveWrap}>
        <span
          className={styles.clarifierValueBox}
          aria-labelledby={`${idPrefix}-clarifier-label`}
        >
          {trimmed}
        </span>
        <span className={styles.chemSuffix} aria-hidden>
          {suffix}
        </span>
        <button
          type="button"
          className={styles.clarifierRemoveBtn}
          onClick={onRemove}
          aria-label="Remove clarifier"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function BeforeAfterRow({
  label,
  setTo,
  beforeId,
  afterId,
  beforeValue,
  afterValue,
  onBefore,
  onAfter,
}) {
  const beforeAria = setTo ? `${label}, set to, before` : `${label} before`;
  const afterAria = setTo ? `${label}, set to, after` : `${label} after`;
  const inputClass = setTo ? `${styles.input} ${styles.inputInCell}` : styles.input;

  const beforeInput = (
    <input
      id={beforeId}
      className={inputClass}
      type="text"
      inputMode="decimal"
      value={beforeValue}
      onChange={(e) => onBefore(e.target.value)}
      aria-label={beforeAria}
      autoComplete="off"
    />
  );
  const afterInput = (
    <input
      id={afterId}
      className={inputClass}
      type="text"
      inputMode="decimal"
      value={afterValue}
      onChange={(e) => onAfter(e.target.value)}
      aria-label={afterAria}
      autoComplete="off"
    />
  );

  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{label}</div>
      {setTo ? (
        <>
          <div className={styles.inputCell}>
            <span className={styles.setToLabel}>Set to</span>
            {beforeInput}
          </div>
          <div className={styles.inputCell}>
            <span className={styles.setToLabel}>Set to</span>
            {afterInput}
          </div>
        </>
      ) : (
        <>
          {beforeInput}
          {afterInput}
        </>
      )}
    </div>
  );
}

function BeforeAfterSection({
  title,
  titleId,
  rows,
  values,
  idPrefix,
  onCellChange,
  onNormalColumn,
  children,
}) {
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 className={styles.sectionTitle} id={titleId}>
        {title}
      </h2>
      <div className={styles.table}>
        <div className={styles.headerRow}>
          <span className={styles.headerSpacer} aria-hidden />
          <span className={styles.colHeader}>Before</span>
          <span className={styles.colHeader}>After</span>
        </div>
        <div className={styles.normalBtnRow}>
          <span className={styles.normalBtnRowSpacer} aria-hidden />
          <button
            type="button"
            className={styles.normalFillBtn}
            id={`${idPrefix}-normal-before`}
            onClick={() => onNormalColumn("before")}
            aria-label={`${title}: fill Before with normal TB, FC, pH, TA`}
          >
            Normal
          </button>
          <button
            type="button"
            className={styles.normalFillBtn}
            id={`${idPrefix}-normal-after`}
            onClick={() => onNormalColumn("after")}
            aria-label={`${title}: fill After with normal TB, FC, pH, TA`}
          >
            Normal
          </button>
        </div>
        {rows.map(({ key, label, setTo }) => (
          <BeforeAfterRow
            key={key}
            label={label}
            setTo={!!setTo}
            beforeId={`${idPrefix}-${key}-before`}
            afterId={`${idPrefix}-${key}-after`}
            beforeValue={values[key].before}
            afterValue={values[key].after}
            onBefore={(v) => onCellChange(key, "before", v)}
            onAfter={(v) => onCellChange(key, "after", v)}
          />
        ))}
      </div>
      {children}
    </section>
  );
}

export default function ReadingsForm({
  idPrefix = "readings",
  onWorkStateChange,
  serviceLogRow,
  /** When false, no autosave or unmount flush (wait until today's service_logs are loaded for this tech). */
  serviceLogsReady = false,
}) {
  const [pool, setPool] = useState(() => ({
    tb: pair(),
    fc: pair(),
    ph: pair(),
    ta: pair(),
    poolTemp: pair(),
  }));
  const [spa, setSpa] = useState(() => ({
    tb: pair(),
    fc: pair(),
    ph: pair(),
    ta: pair(),
    spaTemp: pair(),
  }));
  const [poolChem, setPoolChem] = useState(emptyPoolChem);
  const [spaChem, setSpaChem] = useState(emptyChem);

  const stateRef = useRef({ pool, spa, poolChem, spaChem });
  useEffect(() => {
    stateRef.current = { pool, spa, poolChem, spaChem };
  }, [pool, spa, poolChem, spaChem]);

  const onWorkRef = useRef(onWorkStateChange);
  onWorkRef.current = onWorkStateChange;

  const hydratedFromRow = useRef(false);
  const hasUserEditedRef = useRef(false);
  useEffect(() => {
    hydratedFromRow.current = false;
    hasUserEditedRef.current = false;
  }, [idPrefix]);

  useEffect(() => {
    if (!serviceLogRow) return;
    if (hydratedFromRow.current || hasUserEditedRef.current) return;
    const ws = workStateFromServiceLogRow(serviceLogRow);
    if (!ws) return;
    hydratedFromRow.current = true;
    setPool(ws.pool);
    setSpa(ws.spa);
    setPoolChem(ws.poolChem);
    setSpaChem(ws.spaChem);
  }, [serviceLogRow, idPrefix]);

  useEffect(() => {
    if (!onWorkStateChange) return undefined;
    const flush = () => {
      if (!hasUserEditedRef.current) return;
      onWorkRef.current?.(stateRef.current);
    };
    registerWorkFlush(flush);
    return () => {
      unregisterWorkFlush();
      flush();
    };
    // Intentionally once per mount: flush on unmount only (refs hold latest state/callback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPoolCell = (key, side, value) => {
    hasUserEditedRef.current = true;
    setPool((p) => ({
      ...p,
      [key]: { ...p[key], [side]: value },
    }));
  };

  const setSpaCell = (key, side, value) => {
    hasUserEditedRef.current = true;
    setSpa((p) => ({
      ...p,
      [key]: { ...p[key], [side]: value },
    }));
  };

  const fillNormalReadings = (section, side) => {
    hasUserEditedRef.current = true;
    if (section === "pool") {
      setPool((p) => applyNormalReadingsColumn(p, side));
    } else {
      setSpa((p) => applyNormalReadingsColumn(p, side));
    }
  };

  const setPoolChemField = (key, value) => {
    hasUserEditedRef.current = true;
    setPoolChem((c) => ({ ...c, [key]: value }));
  };

  const addPoolClarifier = () => {
    hasUserEditedRef.current = true;
    setPoolChem((c) => ({ ...c, clarifier: POOL_CLARIFIER_DEFAULT }));
  };

  const removePoolClarifier = () => {
    hasUserEditedRef.current = true;
    setPoolChem((c) => ({ ...c, clarifier: "" }));
  };

  const setSpaChemField = (key, value) => {
    hasUserEditedRef.current = true;
    setSpaChem((c) => ({ ...c, [key]: value }));
  };

  useEffect(() => {
    if (!onWorkStateChange || !serviceLogsReady) return undefined;
    const id = window.setTimeout(() => {
      if (!hasUserEditedRef.current) return;
      onWorkRef.current?.(stateRef.current);
    }, 1200);
    return () => clearTimeout(id);
  }, [pool, spa, poolChem, spaChem, onWorkStateChange, serviceLogsReady]);

  return (
    <div className={styles.wrap}>
      <BeforeAfterSection
        title="Pool Readings"
        titleId={`${idPrefix}-pool-heading`}
        rows={POOL_ROWS}
        values={pool}
        idPrefix={`${idPrefix}-pool`}
        onCellChange={setPoolCell}
        onNormalColumn={(side) => fillNormalReadings("pool", side)}
      >
        <h3
          className={styles.subsectionTitle}
          id={`${idPrefix}-pool-chem-heading`}
        >
          Chemicals Added
        </h3>
        <div className={styles.poolChemAdded}>
          <ChemicalsAddedFields
            idPrefix={`${idPrefix}-pool-chem`}
            values={poolChem}
            onFieldChange={setPoolChemField}
            rows={POOL_CHEMICAL_ROWS}
          />
          <div className={styles.clarifierPoolBlock}>
            <PoolClarifierControl
              idPrefix={`${idPrefix}-pool-chem`}
              clarifier={poolChem.clarifier}
              onAdd={addPoolClarifier}
              onRemove={removePoolClarifier}
            />
          </div>
        </div>
      </BeforeAfterSection>

      <BeforeAfterSection
        title="Spa Readings"
        titleId={`${idPrefix}-spa-heading`}
        rows={SPA_ROWS}
        values={spa}
        idPrefix={`${idPrefix}-spa`}
        onCellChange={setSpaCell}
        onNormalColumn={(side) => fillNormalReadings("spa", side)}
      >
        <h3
          className={styles.subsectionTitle}
          id={`${idPrefix}-spa-chem-heading`}
        >
          Chemicals Added
        </h3>
        <ChemicalsAddedFields
          idPrefix={`${idPrefix}-spa-chem`}
          values={spaChem}
          onFieldChange={setSpaChemField}
          rows={SPA_CHEMICAL_ROWS}
        />
      </BeforeAfterSection>
    </div>
  );
}
