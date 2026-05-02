import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ServicePhotoLightbox.module.css";

/**
 * Full-screen viewer for a set of labeled service photos. Swipe horizontally (scroll-snap) or use arrows.
 *
 * @param {{
 *   items: { label: string, url: string }[],
 *   initialIndex: number,
 *   onClose: () => void,
 * }} props
 */
export default function ServicePhotoLightbox({ items, initialIndex, onClose }) {
  const scrollerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const itemsKey = useMemo(() => items.map((i) => i.url).join("\0"), [items]);
  const [activeIdx, setActiveIdx] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1))
  );

  const scrollToIndex = useCallback(
    (idx, behavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el || !items.length) return;
      const i = Math.min(Math.max(0, idx), items.length - 1);
      const w = el.clientWidth;
      if (w <= 0) return;
      el.scrollTo({ left: w * i, behavior });
    },
    [items.length]
  );

  useLayoutEffect(() => {
    const i = Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1));
    setActiveIdx(i);
    const el = scrollerRef.current;
    if (!el || !items.length) return;
    const apply = () => {
      const w = el.clientWidth;
      if (w > 0) el.scrollTo({ left: w * i, behavior: "auto" });
    };
    apply();
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
    return () => window.cancelAnimationFrame(id);
  }, [initialIndex, itemsKey, items.length]);

  const readIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !items.length) return 0;
    const w = el.clientWidth;
    if (w <= 0) return 0;
    return Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / w)));
  }, [items.length]);

  const onScroll = useCallback(() => {
    setActiveIdx(readIndexFromScroll());
  }, [readIndexFromScroll]);

  const goPrev = useCallback(() => {
    const next = Math.max(0, activeIdx - 1);
    scrollToIndex(next);
    setActiveIdx(next);
  }, [activeIdx, scrollToIndex]);

  const goNext = useCallback(() => {
    const next = Math.min(items.length - 1, activeIdx + 1);
    scrollToIndex(next);
    setActiveIdx(next);
  }, [activeIdx, items.length, scrollToIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!items.length) return null;

  const canPrev = activeIdx > 0;
  const canNext = activeIdx < items.length - 1;

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Service photo viewer"
      onClick={onClose}
    >
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeFab} onClick={onClose} aria-label="Close photo viewer">
          Close
        </button>

        {items.length > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.navFab} ${styles.navPrev}`}
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.navFab} ${styles.navNext}`}
              onClick={goNext}
              disabled={!canNext}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        ) : null}

        <div
          ref={scrollerRef}
          className={styles.scroller}
          onScroll={onScroll}
          aria-live="polite"
        >
          {items.map((item) => (
            <div key={item.url} className={styles.slide}>
              <img src={item.url} alt={item.label} className={styles.fullImg} />
              <p className={styles.caption}>{item.label}</p>
            </div>
          ))}
        </div>

        {items.length > 1 ? (
          <p className={styles.counter}>
            {activeIdx + 1} / {items.length}
          </p>
        ) : (
          <p className={styles.counter}>{items[0].label}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
