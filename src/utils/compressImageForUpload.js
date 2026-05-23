const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_EXT = "jpg";

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} type
 * @param {number} quality
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      type,
      quality
    );
  });
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
async function loadOrientedBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

/**
 * Resize and re-encode an image for upload. Preserves EXIF orientation via ImageBitmap.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function compressImageForUpload(file) {
  if (!file) throw new Error("No file to compress");

  const originalSize = file.size;
  const bitmap = await loadOrientedBitmap(file);

  try {
    let { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    if (scale < 1) {
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, OUTPUT_MIME, JPEG_QUALITY);
    const compressedSize = blob.size;
    const ratio = compressedSize > 0 ? originalSize / compressedSize : 0;

    console.log("[compressImage] original size", originalSize, "bytes");
    console.log("[compressImage] compressed size", compressedSize, "bytes");
    console.log(
      "[compressImage] compression ratio",
      `${ratio.toFixed(2)}x (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% smaller)`
    );

    const baseName = (file.name || "photo").replace(/\.[^./\\]+$/, "") || "photo";
    return new File([blob], `${baseName}.${OUTPUT_EXT}`, {
      type: OUTPUT_MIME,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
