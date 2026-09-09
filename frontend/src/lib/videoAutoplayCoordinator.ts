type AutoplayEntry = {
  video: HTMLVideoElement;
  ratio: number;
  enabled: boolean;
};

const entries = new Map<string, AutoplayEntry>();
let activeId: string | null = null;

function pickAndPlay() {
  let bestId: string | null = null;
  let bestRatio = 0;

  for (const [id, entry] of entries) {
    if (entry.enabled && entry.ratio >= 0.6 && entry.ratio > bestRatio) {
      bestRatio = entry.ratio;
      bestId = id;
    }
  }

  if (bestId === activeId) return;

  if (activeId) {
    entries.get(activeId)?.video.pause();
  }

  activeId = bestId;

  if (activeId) {
    const video = entries.get(activeId)?.video;
    if (video) {
      void video.play().catch(() => {});
    }
  }
}

export function registerVideoAutoplay(id: string, video: HTMLVideoElement, enabled: boolean) {
  entries.set(id, { video, ratio: 0, enabled });
  pickAndPlay();

  return () => {
    entries.delete(id);
    if (activeId === id) {
      activeId = null;
      pickAndPlay();
    }
  };
}

export function setVideoAutoplayEnabled(id: string, enabled: boolean) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.enabled = enabled;
  if (!enabled && activeId === id) {
    entry.video.pause();
    activeId = null;
    pickAndPlay();
  } else {
    pickAndPlay();
  }
}

export function setVideoVisibility(id: string, ratio: number) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.ratio = ratio;
  pickAndPlay();
}

export function pauseVideoAutoplay(id: string) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.ratio = 0;
  if (activeId === id) {
    entry.video.pause();
    activeId = null;
    pickAndPlay();
  }
}
