import { auth } from "./firebase-init.js";
import { DRIVE_GATEWAY_URL } from "./drive-config.js";

const TOKEN_TIMEOUT = 12000;

function normaliseDriveId(value) {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

function gatewayMediaUrl(kind, materialId) {
  const id = String(materialId ?? "").trim();
  if (!id || !/^[^/]{1,240}$/.test(id)) {
    throw Object.assign(new Error("MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });
  }
  const base = String(DRIVE_GATEWAY_URL || "").replace(/\/$/, "");
  if (!base) throw Object.assign(new Error("DRIVE_GATEWAY_NOT_CONFIGURED"), { code: "DRIVE_GATEWAY_NOT_CONFIGURED" });
  return `${base}/${kind}/${encodeURIComponent(id)}`;
}

async function fetchGatewayBlob(kind, materialId) {
  if (!auth.currentUser) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
  const token = await auth.currentUser.getIdToken(true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT);
  try {
    const response = await fetch(gatewayMediaUrl(kind, materialId), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `Gateway media request failed (${response.status})`;
      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {}
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return await response.blob();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("NETWORK_TIMEOUT");
      timeoutError.code = "NETWORK_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
  let audioObjectUrl = "";
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
    elements.audioPoster.removeAttribute("src");
  };

  const cleanupAudio = () => {
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = "";
    }
    elements.audioElement.removeAttribute("src");
    elements.audioElement.load();
  };

  const loadPoster = async (material) => {
    cleanupPoster();
    elements.audioPoster.hidden = true;
    elements.audioPosterFallback.hidden = false;
    if (!material?.posterDriveFileId) return;
    try {
      const blob = await fetchGatewayBlob("poster", material.id);
      posterObjectUrl = URL.createObjectURL(blob);
      elements.audioPoster.src = posterObjectUrl;
      elements.audioPoster.hidden = false;
      elements.audioPosterFallback.hidden = true;
    } catch (error) {
      console.warn("Audio poster could not be loaded", error);
      elements.audioPoster.hidden = true;
      elements.audioPosterFallback.hidden = false;
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
    if (!current.id) throw Object.assign(new Error("MEDIA_NOT_CONFIGURED"), { code: "MEDIA_NOT_CONFIGURED" });
    elements.audioTitle.textContent = current.title || "Audio Summary";
    elements.audioSubtitle.textContent = "EZEE VISION CHAMPUA";
    elements.audioCurrent.textContent = "0:00";
    elements.audioDuration.textContent = "0:00";
    elements.audioRange.value = "0";
    elements.audioRange.max = "0";
    setStatus("Loading audio…", "loading");
    elements.audioElement.pause();
    cleanupAudio();
    syncNav();

    const [audioBlob] = await Promise.all([
      fetchGatewayBlob("audio", current.id),
      loadPoster(current),
    ]);
    audioObjectUrl = URL.createObjectURL(audioBlob);
    elements.audioElement.src = audioObjectUrl;
    elements.audioElement.load();
    setPlayIcon();
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
      const message = error?.code === "DRIVE_GATEWAY_NOT_CONFIGURED" ? "Audio gateway is not configured." : error?.code === "AUTH_REQUIRED" ? "Please sign in again and retry." : error?.code === "NETWORK_TIMEOUT" ? "Audio request timed out. Please retry." : "The audio summary could not be loaded. Please retry.";
      setStatus(message, "error");
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
    cleanupAudio();
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
    elements.audioElement.addEventListener("error", () => setStatus("Audio could not be played. Check that the Drive audio is shared as “Anyone with the link → Viewer” and is an MP3, M4A, WAV, OGG or AAC file.", "error"));
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
