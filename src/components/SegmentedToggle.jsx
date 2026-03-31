import styles from "./SegmentedToggle.module.css";

/**
 * @param {{ leftLabel: string, rightLabel: string, value: 'left'|'right', onChange: (v: 'left'|'right') => void, name: string }} props
 */
export default function SegmentedToggle({
  leftLabel,
  rightLabel,
  value,
  onChange,
  name,
}) {
  return (
    <div className={styles.wrap} role="group" aria-label={name}>
      <button
        type="button"
        className={`${styles.segment} ${value === "left" ? styles.segmentActive : styles.segmentInactive}`}
        onClick={() => onChange("left")}
        aria-pressed={value === "left"}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        className={`${styles.segment} ${value === "right" ? styles.segmentActive : styles.segmentInactive}`}
        onClick={() => onChange("right")}
        aria-pressed={value === "right"}
      >
        {rightLabel}
      </button>
    </div>
  );
}
