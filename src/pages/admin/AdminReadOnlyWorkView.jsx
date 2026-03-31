import { useEffect, useState } from "react";
import { formatHoseElapsed, getPoolStart, getSpaStart } from "../../utils/hoseTimers.js";
import styles from "./AdminReadOnlyWorkView.module.css";

const POOL_KEYS = [
  { key: "tb", label: "TB" },
  { key: "fc", label: "FC" },
  { key: "ph", label: "pH" },
  { key: "ta", label: "TA" },
  { key: "poolTemp", label: "Pool Temp" },
];

const SPA_KEYS = [
  { key: "tb", label: "TB" },
  { key: "fc", label: "FC" },
  { key: "ph", label: "pH" },
  { key: "ta", label: "TA" },
  { key: "spaTemp", label: "Spa Temp" },
];

const POOL_CHEM = [
  { key: "pucks", label: "Pucks", suffix: null },
  { key: "granulated", label: "Granulated", suffix: "scoops" },
  { key: "ta", label: "TA", suffix: "scoops" },
];

const SPA_CHEM = [
  { key: "pucks", label: "Mini Pucks", suffix: null },
  { key: "granulated", label: "Granulated", suffix: "scoops" },
  { key: "ta", label: "TA", suffix: "scoops" },
];

function Cell({ children }) {
  return <span className={styles.cell}>{children || "—"}</span>;
}

function BeforeAfterRow({ label, beforeVal, afterVal }) {
  return (
    <div className={styles.baRow}>
      <span className={styles.rowLab}>{label}</span>
      <Cell>{beforeVal}</Cell>
      <Cell>{afterVal}</Cell>
    </div>
  );
}

function formatChem(val, suffix) {
  if (val == null || val === "") return "—";
  return suffix ? `${val} ${suffix}` : String(val);
}

export default function AdminReadOnlyWorkView({
  serviceLog,
  techSlug,
  propertyId,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pool = {
    tb: { before: serviceLog?.pool_tb_before, after: serviceLog?.pool_tb_after },
    fc: { before: serviceLog?.pool_fc_before, after: serviceLog?.pool_fc_after },
    ph: { before: serviceLog?.pool_ph_before, after: serviceLog?.pool_ph_after },
    ta: { before: serviceLog?.pool_ta_before, after: serviceLog?.pool_ta_after },
    poolTemp: { before: serviceLog?.pool_temp_set, after: "" },
  };
  const spa = {
    tb: { before: serviceLog?.spa_tb_before, after: serviceLog?.spa_tb_after },
    fc: { before: serviceLog?.spa_fc_before, after: serviceLog?.spa_fc_after },
    ph: { before: serviceLog?.spa_ph_before, after: serviceLog?.spa_ph_after },
    ta: { before: serviceLog?.spa_ta_before, after: serviceLog?.spa_ta_after },
    spaTemp: { before: "", after: serviceLog?.spa_temp },
  };
  const poolChem = {
    pucks: serviceLog?.pool_pucks,
    granulated: serviceLog?.pool_granulated,
    ta: serviceLog?.pool_ta_added,
  };
  const spaChem = {
    pucks: serviceLog?.spa_mini_pucks,
    granulated: serviceLog?.spa_granulated,
    ta: serviceLog?.spa_ta_added,
  };

  const poolTs = getPoolStart(techSlug, propertyId);
  const spaTs = getSpaStart(techSlug, propertyId);
  const poolRun =
    poolTs != null
      ? formatHoseElapsed(Math.floor((now - poolTs) / 1000))
      : null;
  const spaRun =
    spaTs != null
      ? formatHoseElapsed(Math.floor((now - spaTs) / 1000))
      : null;

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <h2 className={styles.h2}>Hoses (live)</h2>
        <div className={styles.hoseLine}>
          <span className={styles.hoseLab}>Pool</span>
          <span className={styles.hoseVal}>
            {poolTs != null ? `Running · ${poolRun}` : "Not running"}
          </span>
        </div>
        <div className={styles.hoseLine}>
          <span className={styles.hoseLab}>Spa</span>
          <span className={styles.hoseVal}>
            {spaTs != null ? `Running · ${spaRun}` : "Not running"}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Pool Readings</h2>
        <div className={styles.baHead}>
          <span />
          <span className={styles.colH}>Before</span>
          <span className={styles.colH}>After</span>
        </div>
        {POOL_KEYS.map(({ key, label }) => (
          <BeforeAfterRow
            key={key}
            label={label}
            beforeVal={pool[key]?.before}
            afterVal={pool[key]?.after}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Spa Readings</h2>
        <div className={styles.baHead}>
          <span />
          <span className={styles.colH}>Before</span>
          <span className={styles.colH}>After</span>
        </div>
        {SPA_KEYS.map(({ key, label }) => (
          <BeforeAfterRow
            key={key}
            label={label}
            beforeVal={spa[key]?.before}
            afterVal={spa[key]?.after}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Pool · Chemicals added</h2>
        {POOL_CHEM.map(({ key, label, suffix }) => (
          <div key={key} className={styles.chemRow}>
            <span className={styles.rowLab}>{label}</span>
            <span className={styles.chemVal}>
              {formatChem(poolChem[key], suffix)}
            </span>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Spa · Chemicals added</h2>
        {SPA_CHEM.map(({ key, label, suffix }) => (
          <div key={key} className={styles.chemRow}>
            <span className={styles.rowLab}>{label}</span>
            <span className={styles.chemVal}>
              {formatChem(spaChem[key], suffix)}
            </span>
          </div>
        ))}
      </section>

      <p className={styles.saved}>
        {serviceLog ? "Service log loaded for today." : "No service log for today yet."}
      </p>
    </div>
  );
}
