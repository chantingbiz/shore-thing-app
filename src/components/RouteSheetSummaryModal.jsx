import styles from "./RouteSheetSummaryModal.module.css";

function uniq(names) {
  return [...new Set((names ?? []).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * @param {{ summary: object | null, onClose: () => void }} props
 */
export default function RouteSheetSummaryModal({ summary, onClose }) {
  if (!summary) return null;

  const {
    matchedExistingCount,
    createdCount,
    createdPropertyNames,
    nameAddressChangeNames,
    routeStatusChangeNames,
    heatChangeNames,
    hadAnyEffectiveChange,
    errors,
  } = summary;

  const nameAddr = uniq(nameAddressChangeNames);
  const routeCh = uniq(routeStatusChangeNames);
  const heatCh = uniq(heatChangeNames);
  const createdNames = uniq(createdPropertyNames);

  const statusChangeCount = routeCh.length;
  const heatChangeCount = heatCh.length;

  const allAffected = uniq([...createdNames, ...nameAddr, ...routeCh, ...heatCh]);

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-sheet-summary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="route-sheet-summary-title" className={styles.title}>
          Route update summary
        </h2>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.h3}>Counts</h3>
            <ul className={styles.ul}>
              <li>
                <strong>{matchedExistingCount}</strong> propert{matchedExistingCount === 1 ? "y" : "ies"}{" "}
                matched existing
              </li>
              <li>
                <strong>{createdCount}</strong> new propert{createdCount === 1 ? "y" : "ies"} created
              </li>
              <li>
                <strong>{statusChangeCount}</strong> guest/check status change
                {statusChangeCount === 1 ? "" : "s"}
              </li>
              <li>
                <strong>{heatChangeCount}</strong> pool heat change{heatChangeCount === 1 ? "" : "s"}
              </li>
            </ul>
          </section>

          {allAffected.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.h3}>Affected property names</h3>
              <ul className={styles.ul}>
                {allAffected.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.h3}>Names &amp; addresses</h3>
            {nameAddr.length === 0 ? (
              <p className={styles.p}>Did not change any property names or addresses.</p>
            ) : (
              <>
                <p className={styles.p}>Updated {nameAddr.length} name(s) / address(es):</p>
                <ul className={styles.ul}>
                  {nameAddr.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.h3}>Route status (guest / check)</h3>
            {routeCh.length === 0 ? (
              <p className={styles.p}>No route status changes.</p>
            ) : (
              <>
                <p className={styles.p}>
                  Changed route status for {routeCh.length}{" "}
                  {routeCh.length === 1 ? "property" : "properties"}:
                </p>
                <ul className={styles.ul}>
                  {routeCh.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.h3}>Pool heat</h3>
            {heatCh.length === 0 ? (
              <p className={styles.p}>No pool heat flag changes.</p>
            ) : (
              <>
                <p className={styles.p}>
                  Updated pool heat for {heatCh.length}{" "}
                  {heatCh.length === 1 ? "property" : "properties"}:
                </p>
                <ul className={styles.ul}>
                  {heatCh.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {!hadAnyEffectiveChange && errors.length === 0 && matchedExistingCount > 0 ? (
            <p className={styles.highlight}>No changes were needed — routes already up to date.</p>
          ) : null}

          {errors.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.h3}>Issues</h3>
              <ul className={styles.ul}>
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
