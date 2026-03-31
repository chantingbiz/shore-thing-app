import { Navigate, useParams } from "react-router-dom";
import { getStephenPropertyBySlug } from "../../data/stephenProperties.js";
import { formatActivityTime } from "../../utils/activityLog.js";
import { getPropertyCompletedAt } from "../../utils/propertyCompletion.js";
import { getAdminPropertyDayStatus } from "../../utils/technicianPropertyStatus.js";
import { loadWorkSnapshot } from "../../utils/technicianWorkSnapshot.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import AdminReadOnlyWorkView from "./AdminReadOnlyWorkView.jsx";
import styles from "./adminShared.module.css";

export default function AdminActivityPropertyPage() {
  const { techSlug, propertySlug } = useParams();

  if (techSlug !== "stephen") {
    return <Navigate to="/administrator/activity" replace />;
  }

  const property = getStephenPropertyBySlug(propertySlug);
  if (!property) {
    return <Navigate to={`/administrator/activity/${techSlug}`} replace />;
  }

  const snapshot = loadWorkSnapshot("stephen", property.slug);
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
        propertySlug={property.slug}
      />
    </SubpageTemplate>
  );
}
