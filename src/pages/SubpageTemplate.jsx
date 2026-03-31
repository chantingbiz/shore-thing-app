import { Link } from "react-router-dom";
import layout from "../styles/layouts.module.css";

export default function SubpageTemplate({
  title,
  subtitle,
  backTo,
  children,
  readableDarkText = false,
}) {
  const titleClass = readableDarkText
    ? `${layout.title} ${layout.titleReadableDark}`
    : layout.title;
  const subtitleClass = readableDarkText
    ? `${layout.subtitle} ${layout.subtitleReadableDark}`
    : layout.subtitle;

  return (
    <div className={layout.subpageShell}>
      <div className={layout.ambient} aria-hidden />
      <header className={layout.subpageHeader}>
        <Link to={backTo} className={layout.back}>
          <span className={layout.backIcon} aria-hidden>
            ←
          </span>
          Back
        </Link>
        <div className={layout.titleBlock}>
          <h1 className={titleClass}>{title}</h1>
          {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        </div>
      </header>
      <main className={layout.subpageMain}>{children}</main>
    </div>
  );
}
