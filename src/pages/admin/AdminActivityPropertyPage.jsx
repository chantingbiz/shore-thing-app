import { Navigate, useParams } from "react-router-dom";
import { getStephenPropertyBySlug } from "../../data/stephenProperties.js";
import { formatActivityTime } from "../../utils/activityLog.js";
import { getPropertyCompletedAt } from "../../utils/propertyCompletion.js";
import { getAdminPropertyDayStatus } from "../../utils/technicianPropertyStatus.js";
import { getServiceLogRow, primeTechnicianToday } from "../../lib/supabaseStore.js";
import { useSupabaseSyncTick } from "../../lib/useSupabaseSyncTick.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import AdminReadOnlyWorkView from "./AdminReadOnlyWorkView.jsx";
import styles from "./adminShared.module.css";

export default function AdminActivityPropertyPage() {
  const { techSlug, propertySlug } = useParams();
  useSupabaseSyncTick();

  if (techSlug !== "stephen") {
    return <Navigate to="/administrator/activity" replace />;
  }

  const property = getStephenPropertyBySlug(propertySlug);
  if (!property) {
    return <Navigate to={`/administrator/activity/${techSlug}`} replace />;
  }

  primeTechnicianToday("stephen", [property.id]);
  const snapshot = getServiceLogRow("stephen", property.id)?.readings_json ?? null;
  const status = getAdminPropertyDayStatus("stephen", property.slug);
  const completedAt = getPropertyCompletedAt("stephen", property.slug);

  return (
    <SubpageTemplate
      title={property.name}
      subtitle={`${property.address} · Read-only`}
      backTo={`/administrator/activity/${techSlug}`}
      readableDarkText
    >
      {status === "completed" ? (
        <p className={styles.completedBanner} role="status">
          <span className={styles.statusBadgeCompleted}>Completed</span>
          {completedAt != null ? (
            <>
              {" "}
              · marked {formatActivityTime(completedAt)}
            </>
          ) : null}
        </p>
      ) : status === "in_progress" ? (
        <p className={styles.completedBanner} role="status">
          <span className={styles.statusBadgeInProgress}>In progress</span>
        </p>
      ) : null}
      <AdminReadOnlyWorkView
        snapshot={snapshot}
        techSlug={techSlug}
        propertyId={property.id}
      />
    </SubpageTemplate>
  );
}
