import { getGuestCheckLabel, getPoolHeatLabel } from "../utils/adminRouteStorage.js";
import styles from "./RouteParamBadges.module.css";

/**
 * Read-only route parameters from admin Adjust Routes (localStorage).
 * @param {{ propertyId: string, className?: string }} props
 */
export default function RouteParamBadges({ propertyId, className }) {
  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`.trim()}
      aria-label="Route parameters set by administrator"
    >
      <span className={styles.badge}>{getGuestCheckLabel(propertyId)}</span>
      <span className={styles.badge}>{getPoolHeatLabel(propertyId)}</span>
    </div>
  );
}
