import { auth } from "./firebase-init.js";

const LOAD_TIMEOUT = 30_000;

function normaliseDriveId(value) {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

function drivePreviewUrl(fileId) {
  const id = normaliseDriveId(fileId);
  if (!id) throw Object.assign(new Error("MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview?rm=minimal`;
}

function driveThumbnailUrl(fileId) {
  const id = normaliseDriveId(fileId);
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` : "";
}

export function createAudioPlayerController(elements) {
  let current = null;
  let loadTimer = null;
  let bound = false;
  let frame = null;

  const setStatus = (message = "", type = "") => {
    if (!elements.audioStatus) return;
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
    elements.audioFrameHost?.replaceChildren();
  };

  const setPoster = (material) => {
    const posterId = normaliseDriveId(material?.posterDriveFileId);
    const url = driveThumbnailUrl(posterId);

    if (!url) {
      elements.audioPoster?.removeAttribute("src");
      if (elements.audioPoster) elements.audioPoster.hidden = true;
      if (elements.audioPosterFallback) elements.audioPosterFallback.hidden = false;
      return;
    }

    if (elements.audioPoster) {
      elements.audioPoster.onerror = () => {
        elements.audioPoster.hidden = true;
        if (elements.audioPosterFallback) elements.audioPosterFallback.hidden = false;
      };
      elements.audioPoster.src = url;
      elements.audioPoster.hidden = false;
    }
    if (elements.audioPosterFallback) elements.audioPosterFallback.hidden = true;
  };

  const buildFrame = (material) => {
    cleanup();
    frame = document.createElement("iframe");
    frame.className = "audio-drive-frame";
    frame.title = `${material.title || "Audio Summary"} – Google Drive audio player`;
    frame.setAttribute("allow", "autoplay; fullscreen; encrypted-media");
    frame.setAttribute("allowfullscreen", "true");
    frame.setAttribute("loading", "eager");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.setAttribute("frameborder", "0");
    elements.audioFrameHost.appendChild(frame);

    // Re-create the transparent blocker after cleanup() because cleanup
    // intentionally clears the player host before every new audio.
    // It sits above Drive's top-right external/open control and absorbs
    // taps there, while leaving the actual play/seek/volume controls usable.
    const blocker = document.createElement("div");
    blocker.className = "audio-drive-blocker";
    blocker.setAttribute("aria-hidden", "true");
    blocker.title = "External Drive controls disabled";
    blocker.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    elements.audioFrameHost.appendChild(blocker);
    return frame;
  };

  const load = async (material) => {
    if (!auth.currentUser) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
    const driveId = normaliseDriveId(material?.driveFileId);
    if (!driveId) throw Object.assign(new Error("MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });

    current = material;
    elements.audioTitle.textContent = material.title || "Audio Summary";
    elements.audioSubtitle.textContent = material.chapter
      ? `EZEE VISION CHAMPUA • ${material.chapter}`
      : "EZEE VISION CHAMPUA";
    setPoster(material);
    setStatus("Opening audio player…", "loading");

    const playerFrame = buildFrame(material);
    playerFrame.addEventListener("load", () => {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = null;
      setStatus("", "");
    }, { once: true });
    playerFrame.src = drivePreviewUrl(driveId);

    loadTimer = setTimeout(() => {
      loadTimer = null;
      setStatus("The audio player could not be loaded. Check the Drive file sharing and retry.", "error");
    }, LOAD_TIMEOUT);
  };

  const open = async (material) => {
    setModalOpen(true);
    try {
      await load(material);
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

  const close = () => {
    cleanup();
    setPoster({});
    setStatus("");
    setModalOpen(false);
    current = null;
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    elements.audioClose.addEventListener("click", close);
    elements.audioModal.addEventListener("click", (event) => {
      if (event.target === elements.audioModal) close();
    });
    document.addEventListener("keydown", (event) => {
      if (elements.audioModal.hidden) return;
      if (event.key === "Escape") close();
    });
  };

  return { bind, open, close };
}
