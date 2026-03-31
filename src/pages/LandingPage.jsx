import { Link } from "react-router-dom";
import logo from "../assets/logo_png.png";
import glass from "../styles/glassButtons.module.css";
import layout from "../styles/layouts.module.css";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  return (
    <div className={layout.landingShell}>
      <div className={layout.ambient} aria-hidden />
      <main className={styles.main}>
        <div className={styles.logoWrap}>
          <img
            src={logo}
            alt="Shore Thing Pools & Spas"
            className={styles.logo}
            width={280}
            height={120}
            decoding="async"
          />
        </div>

        <nav className={styles.nav} aria-label="Choose role">
          <Link
            to="/technicians"
            className={`${glass.glassBtn} ${glass.glassBtnFull}`}
          >
            <span className={glass.btnLabel}>Technicians</span>
          </Link>
          <Link
            to="/administrator"
            className={`${glass.glassBtn} ${glass.glassBtnFull}`}
          >
            <span className={glass.btnLabel}>Administrator</span>
          </Link>
        </nav>
      </main>
    </div>
  );
}
