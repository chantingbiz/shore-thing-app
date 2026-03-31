import { Link } from "react-router-dom";
import glass from "../../styles/glassButtons.module.css";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";

export default function AdminHomePage() {
  return (
    <SubpageTemplate title="Administrator" backTo="/" readableDarkText>
      <nav
        className={`${styles.list} ${styles.adminHomeNav}`}
        aria-label="Admin sections"
      >
        <Link
          to="/administrator/activity"
          className={`${glass.glassBtn} ${glass.glassBtnFull}`}
        >
          <span className={glass.btnLabel}>Today&apos;s Activity</span>
        </Link>
        <Link
          to="/administrator/routes"
          className={`${glass.glassBtn} ${glass.glassBtnFull}`}
        >
          <span className={glass.btnLabel}>Adjust Routes</span>
        </Link>
      </nav>
    </SubpageTemplate>
  );
}
