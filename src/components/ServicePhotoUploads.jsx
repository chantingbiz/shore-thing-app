import { useCallback, useRef, useState } from "react";
import { uploadServicePhoto } from "../lib/api.js";
import { getLocalDayKey } from "../utils/localDay.js";
import {
  patchServiceLog,
  primePropertiesBySlug,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";
import { logTechnicianActivity } from "../utils/activityLog.js";
import glass from "../styles/glassButtons.module.css";
import styles from "./ServicePhotoUploads.module.css";

const SLOTS = [
  {
    slot: "pool-before",
    column: "pool_before_photo_url",
    eventType: "pool_before_photo_added",
    label: "Added pool before photo",
    title: "Pool · before",
  },
  {
    slot: "pool-after",
    column: "pool_after_photo_url",
    eventType: "pool_after_photo_added",
    label: "Added pool after photo",
    title: "Pool · after",
  },
  {
    slot: "spa-before",
    column: "spa_before_photo_url",
    eventType: "spa_before_photo_added",
    label: "Added spa before photo",
    title: "Spa · before",
  },
  {
    slot: "spa-after",
    column: "spa_after_photo_url",
    eventType: "spa_after_photo_added",
    label: "Added spa after photo",
    title: "Spa · after",
  },
];

export default function ServicePhotoUploads({
  propertySlug,
  propertyName,
  technicianSlug,
  serviceLogRow,
}) {
  const inputRefs = useRef({});
  const [busySlot, setBusySlot] = useState(null);
  const [error, setError] = useState(null);

  const handlePick = useCallback(
    async (slotDef, fileList) => {
      const file = fileList?.[0];
      if (!file || !propertySlug || !technicianSlug) return;
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }
      primePropertiesBySlug([propertySlug]);
      const propertyId = resolveDbPropertyId(propertySlug);
      if (!propertyId) {
        setError("Property is not loaded yet; try again.");
        return;
      }
      setError(null);
      setBusySlot(slotDef.slot);
      try {
        const serviceDate = getLocalDayKey();
        const { publicUrl } = await uploadServicePhoto(file, {
          techSlug: technicianSlug,
          propertyId,
          serviceDate,
          slot: slotDef.slot,
        });
        const saved = await patchServiceLog(technicianSlug, propertyId, {
          [slotDef.column]: publicUrl,
        });
        if (!saved?.ok) {
          setError("Could not save photo URL to the service log.");
          return;
        }
        logTechnicianActivity(technicianSlug, {
          propertySlug,
          propertyName,
          type: slotDef.eventType,
          label: slotDef.label,
        });
      } catch (e) {
        console.error("photo upload failed", e);
        setError("Upload failed. Check Storage policies and try again.");
      } finally {
        setBusySlot(null);
        const ref = inputRefs.current[slotDef.slot];
        if (ref) ref.value = "";
      }
    },
    [propertySlug, propertyName, technicianSlug]
  );

  return (
    <section className={styles.section} aria-label="Service photos">
      <h2 className={styles.h2}>Photos</h2>
      <div className={styles.grid}>
        {SLOTS.map((s) => {
          const url = serviceLogRow?.[s.column];
          const busy = busySlot === s.slot;
          return (
            <div key={s.slot} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>{s.title}</span>
                <input
                  ref={(el) => {
                    inputRefs.current[s.slot] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  disabled={busy}
                  onChange={(e) => {
                    void handlePick(s, e.target.files);
                  }}
                />
                <button
                  type="button"
                  className={`${glass.glassBtn} ${styles.pickBtn}`}
                  disabled={busy}
                  onClick={() => inputRefs.current[s.slot]?.click()}
                >
                  <span className={glass.btnLabel}>{busy ? "Uploading…" : url ? "Replace" : "Add photo"}</span>
                </button>
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className={styles.thumbLink}>
                  <img src={url} alt="" className={styles.thumb} />
                </a>
              ) : (
                <p className={styles.empty}>No photo yet</p>
              )}
            </div>
          );
        })}
      </div>
      {error ? <p className={styles.err}>{error}</p> : null}
    </section>
  );
}
