const MAX_EDGE = 1600;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

function stem(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0 ? name.slice(0, dot) : name).trim();
  return base || "photo";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    image.src = url;
  });
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  basename: string,
  preferWebp: boolean,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const finish = (blob: Blob | null, type: string, ext: string) => {
      if (!blob) {
        reject(new Error("image_encode_failed"));
        return;
      }
      resolve(new File([blob], `${basename}${ext}`, { type, lastModified: Date.now() }));
    };

    if (preferWebp) {
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            finish(blob, "image/webp", ".webp");
            return;
          }
          canvas.toBlob(
            (jpeg) => finish(jpeg, "image/jpeg", ".jpg"),
            "image/jpeg",
            JPEG_QUALITY,
          );
        },
        "image/webp",
        WEBP_QUALITY,
      );
      return;
    }

    canvas.toBlob((blob) => finish(blob, "image/jpeg", ".jpg"), "image/jpeg", JPEG_QUALITY);
  });
}

/** Downscale camera/gallery photos before presign so S3 stores a display-sized WebP. */
export async function resizeImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const alreadySmall = scale >= 1 && file.size <= 400 * 1024 && file.type === "image/webp";
  if (alreadySmall) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const resized = await canvasToFile(canvas, stem(file.name), true);
  return resized.size > 0 && resized.size < file.size ? resized : file;
}
