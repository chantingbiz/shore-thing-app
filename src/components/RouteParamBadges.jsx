import { getGuestCheckLabel, getPoolHeatLabel } from "../utils/adminRouteStorage.js";
import styles from "./RouteParamBadges.module.css";

/**
 * Read-only route parameters from admin route settings (localStorage).
 * @param {{ propertySlug: string, className?: string }} props
 */
export default function RouteParamBadges({ propertySlug, className }) {
  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`.trim()}
      aria-label="Route parameters set by administrator"
    >
      <span className={styles.badge}>{getGuestCheckLabel(propertySlug)}</span>
      <span className={styles.badge}>{getPoolHeatLabel(propertySlug)}</span>
    </div>
  );
}
