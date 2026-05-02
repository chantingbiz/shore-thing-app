import { useCallback, useMemo, useRef, useState } from "react";
import { uploadServicePhoto } from "../lib/api.js";
import {
  ensurePropertiesBySlug,
  patchServiceLog,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";
import { logTechnicianActivity } from "../utils/activityLog.js";
import { servicePhotoItemsFromRow } from "../utils/servicePhotoSlots.js";
import glass from "../styles/glassButtons.module.css";
import ServicePhotoLightbox from "./ServicePhotoLightbox.jsx";
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

/**
 * Mobile browsers sometimes omit `type` or use non-standard values; still allow obvious image extensions.
 * @param {File | undefined | null} file
 */
function isProbablyImageFile(file) {
  if (!file) return false;
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const name = file.name || "";
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(name)) return true;
  return false;
}

export default function ServicePhotoUploads({
  propertySlug,
  propertyName,
  technicianSlug,
  serviceLogRow,
}) {
  const inputRefs = useRef({});
  const [busySlot, setBusySlot] = useState(null);
  const [error, setError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(/** @type {number | null} */ (null));

  const galleryItems = useMemo(() => servicePhotoItemsFromRow(serviceLogRow), [serviceLogRow]);

  const handlePick = useCallback(
    async (slotDef, fileList) => {
      const file = fileList?.[0];
      console.log("[service photo] input change", {
        slot: slotDef.slot,
        fileCount: fileList?.length ?? 0,
        file: file
          ? { name: file.name, type: file.type, size: file.size }
          : null,
      });
      if (!file || !propertySlug || !technicianSlug) return;
      if (!isProbablyImageFile(file)) {
        setError("Please choose an image file.");
        return;
      }
      try {
        await ensurePropertiesBySlug([propertySlug]);
      } catch (e) {
        console.error("[service photo] ensurePropertiesBySlug failed", e);
        setError("Could not load property; try again.");
        return;
      }
      const propertyId = resolveDbPropertyId(propertySlug);
      if (!propertyId) {
        setError("Property is not loaded yet; try again.");
        return;
      }
      const serviceLogId = serviceLogRow?.id ?? null;
      console.log("[service photo] resolved ids", { propertyId, serviceLogId });

      setError(null);
      setBusySlot(slotDef.slot);
      try {
        const svcDate =
          serviceLogRow?.service_date != null
            ? String(serviceLogRow.service_date).trim() || undefined
            : undefined;
        const { publicUrl } = await uploadServicePhoto(file, {
          propertyId,
          slot: slotDef.slot,
          serviceLogId,
        });
        console.log("[service photo] saving URL to column", slotDef.column, publicUrl);

        const saved = await patchServiceLog(
          technicianSlug,
          propertyId,
          {
            [slotDef.column]: publicUrl,
          },
          svcDate
        );
        console.log("[service photo] database update", saved);

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
        console.error("[service photo] upload or save failed", e);
        setError("Upload failed. Check Storage policies and try again.");
      } finally {
        setBusySlot(null);
        const ref = inputRefs.current[slotDef.slot];
        if (ref) ref.value = "";
      }
    },
    [propertySlug, propertyName, technicianSlug, serviceLogRow?.id, serviceLogRow?.service_date]
  );

  return (
    <section className={styles.section} aria-label="Service photos">
      <h2 className={styles.h2}>Service photos</h2>
      <div className={styles.grid}>
        {SLOTS.map((s) => {
          const url = serviceLogRow?.[s.column];
          const busy = busySlot === s.slot;
          const trimmedUrl = url ? String(url).trim() : "";
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
              {trimmedUrl ? (
                <button
                  type="button"
                  className={styles.thumbLink}
                  aria-label={`View ${s.title} in gallery`}
                  onClick={() => {
                    const idx = galleryItems.findIndex((it) => it.url === trimmedUrl);
                    if (idx >= 0) setLightboxIndex(idx);
                  }}
                >
                  <img src={trimmedUrl} alt="" className={styles.thumb} />
                </button>
              ) : (
                <p className={styles.empty}>No photo yet</p>
              )}
            </div>
          );
        })}
      </div>
      {error ? <p className={styles.err}>{error}</p> : null}
      {lightboxIndex !== null && galleryItems.length ? (
        <ServicePhotoLightbox
          items={galleryItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
}
