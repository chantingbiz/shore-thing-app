import { useEffect, useRef } from "react";
import poolMp4 from "../assets/optimized-pool.mp4";
import styles from "./PoolVideoBackground.module.css";

/**
 * Full-viewport fixed pool-water video behind app UI.
 * Pair with a sibling wrapper at z-index ≥ 1 for routes/content.
 */
export default function PoolVideoBackground() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => {
      if (mq.matches) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
    };

    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className={styles.root} aria-hidden>
      <video
        ref={videoRef}
        className={styles.video}
        src={poolMp4}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        preload="auto"
      />
      <div className={styles.overlay} />
    </div>
  );
}
