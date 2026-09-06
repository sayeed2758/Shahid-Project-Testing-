import { auth } from "./firebase-init.js";

const TOKEN_TIMEOUT = 12000;

function normaliseDriveId(value) {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

function gatewayBase() {
  const base = window.__EVC_DRIVE_GATEWAY_URL__ || "";
  return String(base).replace(/\/$/, "");
}

async function firebaseToken() {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
  return Promise.race([
    user.getIdToken(true),
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("TOKEN_TIMEOUT"), { code: "TOKEN_TIMEOUT" })), TOKEN_TIMEOUT)),
  ]);
}

async function streamUrl(kind, material) {
  const base = gatewayBase();
  if (!base) throw Object.assign(new Error("DRIVE_GATEWAY_NOT_CONFIGURED"), { code: "DRIVE_GATEWAY_NOT_CONFIGURED" });
  const fileId = normaliseDriveId(kind === "poster" ? material?.posterDriveFileId : material?.driveFileId);
  if (!fileId) throw Object.assign(new Error(kind === "poster" ? "MEDIA_NOT_CONFIGURED" : "MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });
  const token = await firebaseToken();
  const url = new URL(`${base}/${kind}/${encodeURIComponent(material.id)}`);
  // The gateway also supports the token from the query string so native media elements can authenticate.
  url.searchParams.set("token", token);
  return url.toString();
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function createAudioPlayerController(elements) {
  let current = null;
  let queue = [];
  let index = -1;
  let posterObjectUrl = "";
  let bound = false;

  const setStatus = (message = "", type = "") => {
    elements.audioStatus.textContent = message;
    elements.audioStatus.className = `audio-status ${type}`.trim();
  };

  const setModalOpen = (open) => {
    elements.audioModal.hidden = !open;
    document.body.classList.toggle("audio-player-open", open);
  };

  const cleanupPoster = () => {
    if (posterObjectUrl) {
      URL.revokeObjectURL(posterObjectUrl);
      posterObjectUrl = "";
    }
  };

  const loadPoster = async (material) => {
    cleanupPoster();
    elements.audioPoster.hidden = true;
    elements.audioPosterFallback.hidden = false;
    if (!material?.posterDriveFileId) return;
    try {
      const url = await streamUrl("poster", material);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`POSTER_${response.status}`);
      const blob = await response.blob();
      posterObjectUrl = URL.createObjectURL(blob);
      elements.audioPoster.src = posterObjectUrl;
      elements.audioPoster.hidden = false;
      elements.audioPosterFallback.hidden = true;
    } catch (error) {
      console.warn("Audio poster load failed:", error);
    }
  };

  const syncNav = () => {
    const hasQueue = queue.length > 1;
    elements.audioPrevBtn.disabled = !hasQueue;
    elements.audioNextBtn.disabled = !hasQueue;
  };

  const setPlayIcon = () => {
    elements.audioPlayBtn.textContent = elements.audioElement.paused ? "▶" : "Ⅱ";
    elements.audioPlayBtn.setAttribute("aria-label", elements.audioElement.paused ? "Play" : "Pause");
  };

  const load = async (material, autoplay = true) => {
    current = material;
    if (!current) return;
    elements.audioTitle.textContent = current.title || "Audio Summary";
    elements.audioSubtitle.textContent = "EZEE VISION CHAMPUA";
    elements.audioCurrent.textContent = "0:00";
    elements.audioDuration.textContent = "0:00";
    elements.audioRange.value = "0";
    elements.audioRange.max = "0";
    setStatus("Loading audio…", "loading");
    await loadPoster(current);
    const url = await streamUrl("audio", current);
    elements.audioElement.pause();
    elements.audioElement.src = url;
    elements.audioElement.load();
    setPlayIcon();
    syncNav();
    if (autoplay) {
      try {
        await elements.audioElement.play();
      } catch {
        setStatus("Audio is ready. Tap Play to start.", "ready");
      }
    }
  };

  const open = async (material, materialQueue, watermark) => {
    queue = Array.isArray(materialQueue) && materialQueue.length ? materialQueue : [material];
    index = Math.max(0, queue.findIndex(item => item.id === material.id));
    if (index < 0) index = 0;
    setModalOpen(true);
    elements.audioElement.dataset.watermark = watermark || "";
    try {
      await load(queue[index], true);
    } catch (error) {
      console.error(error);
      setStatus("The audio summary could not be loaded. Please retry.", "error");
    }
  };

  const move = async (direction) => {
    if (!queue.length || queue.length < 2) return;
    index = (index + direction + queue.length) % queue.length;
    try {
      await load(queue[index], true);
    } catch (error) {
      console.error(error);
      setStatus("The next audio could not be loaded.", "error");
    }
  };

  const close = () => {
    elements.audioElement.pause();
    elements.audioElement.removeAttribute("src");
    elements.audioElement.load();
    cleanupPoster();
    setStatus("");
    setModalOpen(false);
    current = null;
    queue = [];
    index = -1;
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    elements.audioPlayBtn.addEventListener("click", async () => {
      if (elements.audioElement.paused) {
        try { await elements.audioElement.play(); setStatus("Playing", "playing"); }
        catch { setStatus("Tap Play again to start the audio.", "error"); }
      } else {
        elements.audioElement.pause();
        setStatus("Paused", "ready");
      }
      setPlayIcon();
    });
    elements.audioPrevBtn.addEventListener("click", () => move(-1));
    elements.audioNextBtn.addEventListener("click", () => move(1));
    elements.audioClose.addEventListener("click", close);
    elements.audioRepeatBtn.addEventListener("click", () => {
      elements.audioElement.loop = !elements.audioElement.loop;
      elements.audioRepeatBtn.classList.toggle("is-active", elements.audioElement.loop);
      setStatus(elements.audioElement.loop ? "Repeat on" : "Repeat off", "ready");
    });
    elements.audioElement.addEventListener("loadedmetadata", () => {
      const duration = Number(elements.audioElement.duration);
      if (Number.isFinite(duration) && duration > 0) {
        elements.audioRange.max = String(duration);
        elements.audioDuration.textContent = formatTime(duration);
      }
      setStatus("Ready", "ready");
      setPlayIcon();
    });
    elements.audioElement.addEventListener("timeupdate", () => {
      const currentTime = Number(elements.audioElement.currentTime) || 0;
      const duration = Number(elements.audioElement.duration) || 0;
      elements.audioCurrent.textContent = formatTime(currentTime);
      elements.audioRange.value = String(currentTime);
      if (duration > 0) elements.audioRange.max = String(duration);
    });
    elements.audioElement.addEventListener("play", () => { setPlayIcon(); setStatus("Playing", "playing"); });
    elements.audioElement.addEventListener("pause", () => { setPlayIcon(); if (!elements.audioElement.ended) setStatus("Paused", "ready"); });
    elements.audioElement.addEventListener("ended", () => {
      if (elements.audioElement.loop) return;
      if (queue.length > 1) move(1);
      else setStatus("Finished", "ready");
    });
    elements.audioElement.addEventListener("error", () => setStatus("Audio could not be played. Check the Drive file permission and format.", "error"));
    elements.audioRange.addEventListener("input", () => {
      elements.audioElement.currentTime = Number(elements.audioRange.value) || 0;
    });
    elements.audioModal.addEventListener("click", (event) => {
      if (event.target === elements.audioModal) close();
    });
    document.addEventListener("keydown", (event) => {
      if (elements.audioModal.hidden) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === " ") {
        event.preventDefault();
        elements.audioPlayBtn.click();
      }
    });
  };

  return { bind, open, close };
}
