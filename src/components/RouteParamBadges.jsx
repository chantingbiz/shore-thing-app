import { getGuestCheckLabel, getPoolHeatLabel } from "../utils/adminRouteStorage.js";
import styles from "./RouteParamBadges.module.css";

/**
 * Labels default from `route_settings` via slug. Pass `routeSheet` (e.g. `route_sheet_items` row)
 * to show guest/pool heat from the sent sheet instead.
 *
 * @param {{
 *   propertySlug: string,
 *   className?: string,
 *   routeSheet?: { guest_check?: string | null, pool_heat?: string | null } | null,
 * }} props
 */
export default function RouteParamBadges({ propertySlug, className, routeSheet }) {
  const fromSheet = routeSheet && typeof routeSheet === "object";
  const gc = fromSheet ? String(routeSheet.guest_check ?? "").toLowerCase() : "";
  const guestLabel =
    gc === "check" ? "Check" : gc === "guest" ? "Guest" : getGuestCheckLabel(propertySlug);

  const ph = fromSheet ? String(routeSheet.pool_heat ?? "").toLowerCase() : "";
  const poolLabel =
    ph === "pool_heat" || ph === "heat"
      ? "Pool Heat"
      : ph === "no_pool_heat"
        ? "No Pool Heat"
        : getPoolHeatLabel(propertySlug);

  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`.trim()}
      aria-label="Route parameters for this visit"
    >
      <span className={styles.badge}>{guestLabel}</span>
      <span className={styles.badge}>{poolLabel}</span>
    </div>
  );
}
