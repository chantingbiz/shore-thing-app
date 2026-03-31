import { Link } from "react-router-dom";
import { TECHNICIANS } from "../../data/technicians.js";
import SubpageTemplate from "../SubpageTemplate.jsx";
import styles from "./adminShared.module.css";

export default function AdminRoutesPage() {
  return (
    <SubpageTemplate title="Adjust Routes" backTo="/administrator" readableDarkText>
      <p className={styles.intro}>Select a technician route</p>
      <nav className={styles.list} aria-label="Technicians">
        {TECHNICIANS.map((t) => (
          <Link
            key={t.slug}
            to={`/administrator/routes/${t.slug}`}
            className={styles.cardLink}
          >
            <p className={styles.cardTitle}>{t.name}</p>
          </Link>
        ))}
      </nav>
    </SubpageTemplate>
  );
}
