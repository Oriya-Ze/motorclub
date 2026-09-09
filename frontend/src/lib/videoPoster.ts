export const MAX_POST_VIDEO_DURATION_SEC = 60;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(code)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function getVideoDuration(file: File, timeoutMs = 8000): Promise<number> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("invalid_video"));
      };
      video.src = url;
    }),
    timeoutMs,
    "duration_timeout",
  );
}

/** Lightweight preview URL — caller must revoke when done. */
export function createVideoPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
