import { useCallback, useState } from "react";
import { STEPHEN_PROPERTIES } from "../../data/stephenProperties.js";
import {
  getGuestCheckMode,
  getPoolHeatMode,
  setGuestCheckMode,
  setPoolHeatMode,
} from "../../utils/adminRouteStorage.js";
import SegmentedToggle from "../../components/SegmentedToggle.jsx";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";
import rowStyles from "./AdminStephenRoutesPage.module.css";

function RoutePropertyCard({ slug, name }) {
  const [guestSeg, setGuestSeg] = useState(() =>
    getGuestCheckMode(slug) === "check" ? "right" : "left"
  );
  const [heatSeg, setHeatSeg] = useState(() =>
    getPoolHeatMode(slug) === "no_heat" ? "right" : "left"
  );

  const onGuest = useCallback(
    (v) => {
      setGuestSeg(v);
      setGuestCheckMode(slug, v === "left" ? "guest" : "check");
    },
    [slug]
  );

  const onHeat = useCallback(
    (v) => {
      setHeatSeg(v);
      setPoolHeatMode(slug, v === "left" ? "heat" : "no_heat");
    },
    [slug]
  );

  return (
    <article className={rowStyles.card}>
      <h2 className={rowStyles.propertyName}>{name}</h2>
      <div className={rowStyles.row}>
        <span className={rowStyles.label}>Guest / Check</span>
        <SegmentedToggle
          name={`guest-check-${slug}`}
          leftLabel="Guest"
          rightLabel="Check"
          value={guestSeg}
          onChange={onGuest}
        />
      </div>
      <div className={rowStyles.row}>
        <span className={rowStyles.label}>Pool heat</span>
        <SegmentedToggle
          name={`pool-heat-${slug}`}
          leftLabel="Pool Heat"
          rightLabel="No Pool Heat"
          value={heatSeg}
          onChange={onHeat}
        />
      </div>
    </article>
  );
}

export default function AdminStephenRoutesPage() {
  return (
    <SubpageTemplate
      title="Stephen — Routes"
      backTo="/administrator/routes"
      readableDarkText
    >
      <p className={styles.intro}>
        Guest/Check and pool heat flags per property (saved on this device).
      </p>
      <div className={rowStyles.list}>
        {STEPHEN_PROPERTIES.map((p) => (
          <RoutePropertyCard key={p.slug} slug={p.slug} name={p.name} />
        ))}
      </div>
    </SubpageTemplate>
  );
}
