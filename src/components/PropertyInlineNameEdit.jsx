import { useCallback, useEffect, useState } from "react";
import { updateProperty } from "../lib/api.js";
import styles from "./PropertyInlineNameEdit.module.css";

/**
 * Small inline name editor for technician property lists (updates `properties.name`).
 *
 * @param {{ propertyId: string | null | undefined, name: string, onUpdated?: () => void, className?: string }} props
 */
export default function PropertyInlineNameEdit({ propertyId, name, onUpdated, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(name);
    setErr(null);
  }, [name]);

  const save = useCallback(async () => {
    const id = propertyId?.trim();
    if (!id) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setErr("Name cannot be empty.");
      return;
    }
    if (trimmed === name) {
      cancel();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await updateProperty(id, { name: trimmed });
      onUpdated?.();
      setEditing(false);
    } catch (e) {
      console.error(e);
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [propertyId, draft, name, onUpdated, cancel]);

  if (!propertyId) return null;

  if (!editing) {
    return (
      <button
        type="button"
        className={`${styles.editBtn} ${className}`.trim()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraft(name);
          setErr(null);
          setEditing(true);
        }}
      >
        Edit
      </button>
    );
  }

  return (
    <span
      className={`${styles.wrap} ${className}`.trim()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <input
        type="text"
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={busy}
        aria-label="Property name"
      />
      <button type="button" className={styles.miniBtn} onClick={() => void save()} disabled={busy}>
        {busy ? "…" : "Save"}
      </button>
      <button type="button" className={styles.miniBtnGhost} onClick={cancel} disabled={busy}>
        Cancel
      </button>
      {err ? (
        <span className={styles.err} role="alert">
          {err}
        </span>
      ) : null}
    </span>
  );
}
