import { useEffect, useState } from "react";
import styles from "./ReadingsForm.module.css";

const pair = () => ({ before: "", after: "" });

const emptyChem = () => ({
  pucks: "",
  granulated: "",
  ta: "",
});

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

export default function ReadingsForm({ idPrefix = "readings", onWorkStateChange }) {
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
  const [poolChem, setPoolChem] = useState(emptyChem);
  const [spaChem, setSpaChem] = useState(emptyChem);

  const setPoolCell = (key, side, value) => {
    setPool((p) => ({
      ...p,
      [key]: { ...p[key], [side]: value },
    }));
  };

  const setSpaCell = (key, side, value) => {
    setSpa((p) => ({
      ...p,
      [key]: { ...p[key], [side]: value },
    }));
  };

  const setPoolChemField = (key, value) => {
    setPoolChem((c) => ({ ...c, [key]: value }));
  };

  const setSpaChemField = (key, value) => {
    setSpaChem((c) => ({ ...c, [key]: value }));
  };

  useEffect(() => {
    if (!onWorkStateChange) return undefined;
    const id = window.setTimeout(() => {
      onWorkStateChange({ pool, spa, poolChem, spaChem });
    }, 1200);
    return () => clearTimeout(id);
  }, [pool, spa, poolChem, spaChem, onWorkStateChange]);

  return (
    <div className={styles.wrap}>
      <BeforeAfterSection
        title="Pool Readings"
        titleId={`${idPrefix}-pool-heading`}
        rows={POOL_ROWS}
        values={pool}
        idPrefix={`${idPrefix}-pool`}
        onCellChange={setPoolCell}
      >
        <h3
          className={styles.subsectionTitle}
          id={`${idPrefix}-pool-chem-heading`}
        >
          Chemicals Added
        </h3>
        <ChemicalsAddedFields
          idPrefix={`${idPrefix}-pool-chem`}
          values={poolChem}
          onFieldChange={setPoolChemField}
          rows={POOL_CHEMICAL_ROWS}
        />
      </BeforeAfterSection>

      <BeforeAfterSection
        title="Spa Readings"
        titleId={`${idPrefix}-spa-heading`}
        rows={SPA_ROWS}
        values={spa}
        idPrefix={`${idPrefix}-spa`}
        onCellChange={setSpaCell}
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
