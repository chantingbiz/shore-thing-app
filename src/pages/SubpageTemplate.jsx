import { Link } from "react-router-dom";
import layout from "../styles/layouts.module.css";

export default function SubpageTemplate({
  title,
  subtitle,
  backTo,
  children,
  readableDarkText = false,
  /** Wider max-width for desktop admin tools (e.g. route sheet dashboard). */
  wideLayout = false,
  /** Optional content directly under the Back link and above the title block (e.g. loading status). */
  belowBack = null,
}) {
  const titleClass = readableDarkText
    ? `${layout.title} ${layout.titleReadableDark}`
    : layout.title;
  const subtitleClass = readableDarkText
    ? `${layout.subtitle} ${layout.subtitleReadableDark}`
    : layout.subtitle;

  const shellClass = wideLayout
    ? `${layout.subpageShell} ${layout.subpageShellWide}`
    : layout.subpageShell;

  return (
    <div className={shellClass}>
      <div className={layout.ambient} aria-hidden />
      <header className={layout.subpageHeader}>
        <Link to={backTo} className={layout.back}>
          <span className={layout.backIcon} aria-hidden>
            ←
          </span>
          Back
        </Link>
        {belowBack ? <div className={layout.belowBackSlot}>{belowBack}</div> : null}
        <div className={layout.titleBlock}>
          <h1 className={titleClass}>{title}</h1>
          {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        </div>
      </header>
      <main className={layout.subpageMain}>{children}</main>
    </div>
  );
}
