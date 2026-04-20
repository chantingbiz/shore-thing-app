import { useCallback, useState } from "react";
import ServicePhotoLightbox from "./ServicePhotoLightbox.jsx";
import styles from "./ServicePhotoGallery.module.css";

/**
 * Thumbnail strip for service photos; opens {@link ServicePhotoLightbox} on tap.
 *
 * @param {{
 *   items: { label: string, url: string }[],
 *   variant?: 'default' | 'compact',
 *   showThumbLabels?: boolean,
 *   className?: string,
 *   listClassName?: string,
 * }} props
 */
export default function ServicePhotoGallery({
  items,
  variant = "default",
  showThumbLabels,
  className,
  listClassName,
}) {
  const [openAt, setOpenAt] = useState(/** @type {number | null} */ (null));

  const showLabels = showThumbLabels ?? variant !== "compact";

  const open = useCallback((index) => {
    setOpenAt(index);
  }, []);

  const close = useCallback(() => setOpenAt(null), []);

  if (!items?.length) return null;

  const listClass = [
    styles.list,
    variant === "compact" ? styles.listCompact : "",
    listClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={[styles.wrap, className || ""].filter(Boolean).join(" ")}>
      <div className={listClass} role="list">
        {items.map((item, i) => (
          <button
            key={item.url}
            type="button"
            className={[
              styles.thumbBtn,
              variant === "compact" ? styles.thumbBtnCompact : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="listitem"
            onClick={() => open(i)}
            aria-label={`View ${item.label} (${i + 1} of ${items.length})`}
          >
            {showLabels ? <span className={styles.thumbLab}>{item.label}</span> : null}
            <img src={item.url} alt="" className={styles.thumbImg} loading="lazy" />
          </button>
        ))}
      </div>
      {openAt !== null ? (
        <ServicePhotoLightbox items={items} initialIndex={openAt} onClose={close} />
      ) : null}
    </div>
  );
}
