import { auth } from "./firebase-init.js";

const LOAD_TIMEOUT = 30_000;

function normaliseDriveId(value) {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

function drivePreviewUrl(fileId) {
  const id = normaliseDriveId(fileId);
  if (!id) throw Object.assign(new Error("MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });
  // Same in-app Google Drive preview pattern used by the existing PDF reader.
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview?rm=minimal`;
}

function driveThumbnailUrl(fileId) {
  const id = normaliseDriveId(fileId);
  if (!id) return "";
  // Public/link-shared Drive images can be rendered directly as thumbnails.
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
}

export function createAudioPlayerController(elements) {
  let current = null;
  let queue = [];
  let index = -1;
  let loadTimer = null;
  let bound = false;
  let frame = null;

  const setStatus = (message = "", type = "") => {
    elements.audioStatus.textContent = message;
    elements.audioStatus.className = `audio-status ${type}`.trim();
  };

  const setModalOpen = (open) => {
    elements.audioModal.hidden = !open;
    document.body.classList.toggle("audio-player-open", open);
  };

  const cleanup = () => {
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
    if (frame) {
      frame.src = "about:blank";
      frame.remove();
      frame = null;
    }
    if (elements.audioFrameHost) elements.audioFrameHost.replaceChildren();
  };

  const syncNav = () => {
    const hasQueue = queue.length > 1;
    elements.audioPrevBtn.disabled = !hasQueue;
    elements.audioNextBtn.disabled = !hasQueue;
  };

  const setPoster = (material) => {
    const posterId = normaliseDriveId(material?.posterDriveFileId);
    const url = posterId ? driveThumbnailUrl(posterId) : "";
    elements.audioPoster.onerror = () => {
      elements.audioPoster.hidden = true;
      elements.audioPosterFallback.hidden = false;
    };
    if (!url) {
      elements.audioPoster.removeAttribute("src");
      elements.audioPoster.hidden = true;
      elements.audioPosterFallback.hidden = false;
      return;
    }
    elements.audioPoster.src = url;
    elements.audioPoster.hidden = false;
    elements.audioPosterFallback.hidden = true;
  };

  const buildFrame = (material) => {
    if (!elements.audioFrameHost) throw Object.assign(new Error("AUDIO_FRAME_CONTAINER_MISSING"), { code: "AUDIO_FRAME_CONTAINER_MISSING" });
    cleanup();
    frame = document.createElement("iframe");
    frame.className = "audio-drive-frame";
    frame.title = `${material.title || "Audio Summary"} – Google Drive player`;
    frame.setAttribute("allow", "autoplay; fullscreen; encrypted-media");
    frame.setAttribute("allowfullscreen", "true");
    frame.setAttribute("loading", "eager");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.setAttribute("frameborder", "0");
    elements.audioFrameHost.appendChild(frame);
    return frame;
  };

  const load = async (material) => {
    if (!auth.currentUser) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
    const driveId = normaliseDriveId(material?.driveFileId);
    if (!driveId) throw Object.assign(new Error("MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });

    current = material;
    elements.audioTitle.textContent = material.title || "Audio Summary";
    elements.audioSubtitle.textContent = material.chapter ? `EZEE VISION CHAMPUA • ${material.chapter}` : "EZEE VISION CHAMPUA";
    setPoster(material);
    syncNav();
    setStatus("Opening Google Drive audio player…", "loading");
    elements.audioPlayBtn.textContent = "▶";
    elements.audioPlayBtn.setAttribute("aria-label", "Open / play audio");

    const playerFrame = buildFrame(material);
    playerFrame.addEventListener("load", () => {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = null;
      setStatus("Audio player ready. Use the controls inside the player to play, pause and seek.", "success");
    }, { once: true });
    playerFrame.src = drivePreviewUrl(driveId);

    loadTimer = setTimeout(() => {
      loadTimer = null;
      setStatus("The Google Drive audio player could not be loaded. Check the Drive file sharing and retry.", "error");
    }, LOAD_TIMEOUT);
  };

  const open = async (material, materialQueue) => {
    queue = Array.isArray(materialQueue) && materialQueue.length ? materialQueue : [material];
    index = Math.max(0, queue.findIndex(item => item.id === material?.id));
    if (index < 0) index = 0;
    setModalOpen(true);
    try {
      await load(queue[index]);
    } catch (error) {
      console.error(error);
      const message = error?.code === "AUTH_REQUIRED"
        ? "Please sign in again and retry."
        : error?.code === "MEDIA_NOT_CONFIGURED"
          ? "This audio summary has no valid Google Drive file."
          : "The audio summary could not be loaded. Please retry.";
      setStatus(message, "error");
    }
  };

  const move = async (direction) => {
    if (queue.length < 2) return;
    index = (index + direction + queue.length) % queue.length;
    try {
      await load(queue[index]);
    } catch (error) {
      console.error(error);
      setStatus("The selected audio could not be loaded. Please retry.", "error");
    }
  };

  const close = () => {
    cleanup();
    setPoster({});
    setStatus("");
    setModalOpen(false);
    current = null;
    queue = [];
    index = -1;
  };

  const retry = () => {
    if (current) void load(current);
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    elements.audioPrevBtn.addEventListener("click", () => void move(-1));
    elements.audioNextBtn.addEventListener("click", () => void move(1));
    elements.audioClose.addEventListener("click", close);
    elements.audioPlayBtn.addEventListener("click", () => {
      // The actual playback controls belong to Google Drive's same-file preview iframe.
      if (current?.driveFileId) {
        try {
          if (frame) frame.src = drivePreviewUrl(current.driveFileId);
          else void load(current);
          setStatus("Drive player refreshed. Tap Play inside the player to start.", "ready");
        } catch (error) {
          console.error(error);
          setStatus("The audio player could not be opened. Please retry.", "error");
        }
      }
    });
    elements.audioRetryBtn?.addEventListener("click", retry);
    elements.audioModal.addEventListener("click", (event) => {
      if (event.target === elements.audioModal) close();
    });
    document.addEventListener("keydown", (event) => {
      if (elements.audioModal.hidden) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") void move(-1);
      if (event.key === "ArrowRight") void move(1);
    });
  };

  return { bind, open, close };
}
