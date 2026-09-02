import { auth } from "./firebase-init.js";
import { DRIVE_GATEWAY_URL } from "./drive-config.js";

const LOAD_TIMEOUT = 30_000;

function gatewayEndpoint(path) {
  if (!DRIVE_GATEWAY_URL) throw new Error("DRIVE_GATEWAY_NOT_CONFIGURED");
  return `${DRIVE_GATEWAY_URL.replace(/\/$/, "")}${path}`;
}

async function fetchGatewayBlob(path, { timeoutMs = LOAD_TIMEOUT } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await user.getIdToken();
    const response = await fetch(gatewayEndpoint(path), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      let payload = null;
      if (contentType.includes("application/json")) {
        try { payload = await response.json(); } catch {}
      }
      const error = new Error(payload?.message || `Gateway request failed (${response.status})`);
      error.code = payload?.code || (response.status === 401 ? "AUTH_REQUIRED" : response.status === 403 ? "PDF_ACCESS_DENIED" : "GATEWAY_ERROR");
      error.status = response.status;
      throw error;
    }
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw new Error("GATEWAY_INVALID_PDF_RESPONSE");
    }
    return { blob: await response.blob(), contentDisposition: response.headers.get("content-disposition") || "" };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("NETWORK_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function safeDownloadName(material) {
  const source = String(material?.fileName || material?.title || "learning-material")
    .replace(/^\"|\"$/g, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${source || "learning-material"}.pdf`;
}

function triggerBlobDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function createProtectedReaderController(elements, { onBusyChange = () => {} } = {}) {
  const paper = elements.readerCanvas?.closest(".reader-paper") || elements.readerCanvas?.parentElement;
  let iframe = null;
  let loading = false;
  let currentMaterial = null;
  let loadTimer = null;

  function setStatus(message = "", type = "") {
    elements.readerStatus.textContent = message;
    elements.readerStatus.className = `reader-status ${type}`.trim();
  }

  function updateControls() {
    // The browser PDF viewer owns page navigation and zoom. Keep only app-level actions visible.
    elements.readerPrev.hidden = true;
    elements.readerNext.hidden = true;
    elements.readerZoomOut.hidden = true;
    elements.readerZoomIn.hidden = true;
    elements.readerPage.hidden = true;
    elements.readerZoomLabel.hidden = true;
    const toolbar = elements.readerModal.querySelector(".reader-toolbar");
    if (toolbar) toolbar.hidden = true;
    elements.readerClose.disabled = loading;
  }

  function cleanupFrame() {
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
    if (iframe) {
      const objectUrl = iframe.dataset.objectUrl || "";
      iframe.src = "about:blank";
      iframe.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      iframe = null;
    }
    if (elements.readerCanvas) elements.readerCanvas.hidden = true;
    if (elements.readerWatermark) elements.readerWatermark.hidden = true;
  }

  function buildFrame(material) {
    if (!paper) throw new Error("PDF_READER_CONTAINER_MISSING");
    cleanupFrame();
    iframe = document.createElement("iframe");
    iframe.className = "reader-drive-frame";
    iframe.title = material.title || "Learning material";
    iframe.setAttribute("allow", "autoplay");
    iframe.setAttribute("loading", "eager");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("frameborder", "0");
    paper.appendChild(iframe);
    return iframe;
  }

  async function open(material, watermarkText = "") {
    close(false);
    if (!auth.currentUser) throw new Error("AUTH_REQUIRED");
    if (!material?.driveFileId) throw new Error("PDF_FILE_ID_MISSING");

    loading = true;
    currentMaterial = { ...material, watermark: watermarkText || "" };
    elements.readerTitle.textContent = material.title || "Learning Material";
    elements.readerModal.hidden = false;
    document.body.classList.add("reader-open");
    elements.readerRetry.hidden = true;
    setStatus("Opening PDF…", "loading");
    updateControls();
    onBusyChange(true);

    try {
      const frame = buildFrame(material);
      frame.addEventListener("load", () => {
        if (!loading) return;
        if (loadTimer) clearTimeout(loadTimer);
        loadTimer = null;
        loading = false;
        elements.readerRetry.hidden = false;
        setStatus("PDF ready. Use the Google Drive viewer to read.", "success");
        updateControls();
        onBusyChange(false);
      }, { once: true });
      const endpoint = material.section === "worksheet" || material.section === "exam-paper"
        ? `/worksheet/${encodeURIComponent(material.id)}/`
        : `/pdf/${encodeURIComponent(material.id)}/`;
      const { blob } = await fetchGatewayBlob(endpoint);
      if (!loading || !iframe) return;
      iframe.src = URL.createObjectURL(blob);
      iframe.dataset.objectUrl = iframe.src;
      loadTimer = setTimeout(() => {
        if (!loading) return;
        loading = false;
        elements.readerRetry.hidden = false;
        setStatus("The PDF preview could not be loaded. Check the Drive link sharing and retry.", "error");
        updateControls();
        onBusyChange(false);
      }, LOAD_TIMEOUT);
    } catch (error) {
      loading = false;
      elements.readerRetry.hidden = false;
      setStatus(error?.message === "PDF_FILE_ID_MISSING" ? "This material has no valid Drive file." : "The PDF preview could not be opened.", "error");
      updateControls();
      onBusyChange(false);
      throw error;
    }
  }

  function close(force = false) {
    if (loading && !force) {
      loading = false;
    }
    cleanupFrame();
    currentMaterial = null;
    elements.readerModal.hidden = true;
    elements.readerRetry.hidden = true;
    document.body.classList.remove("reader-open");
    setStatus("");
    updateControls();
    onBusyChange(false);
  }

  async function retry() {
    if (!currentMaterial) return;
    const material = { ...currentMaterial };
    const watermark = material.watermark || "";
    delete material.watermark;
    await open(material, watermark);
  }

  async function downloadWorksheet(material) {
    if (!material?.id) throw new Error("PDF_FILE_ID_MISSING");
    const { blob } = await fetchGatewayBlob(`/worksheet/${encodeURIComponent(material.id)}/`);
    triggerBlobDownload(blob, safeDownloadName(material));
  }

  function bind() {
    elements.readerPrev.addEventListener("click", () => {});
    elements.readerNext.addEventListener("click", () => {});
    elements.readerZoomOut.addEventListener("click", () => {});
    elements.readerZoomIn.addEventListener("click", () => {});
    elements.readerClose.addEventListener("click", () => close(false));
    elements.readerRetry.addEventListener("click", retry);
    elements.readerModal.addEventListener("click", (event) => {
      if (event.target === elements.readerModal && !loading) close(false);
    });
    ["contextmenu", "dragstart", "selectstart"].forEach((type) => {
      elements.readerModal.addEventListener(type, (event) => event.preventDefault());
    });
    document.addEventListener("keydown", (event) => {
      if (elements.readerModal.hidden) return;
      if ((event.ctrlKey || event.metaKey) && ["p", "s", "u"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        setStatus("That action is disabled in the app reader.", "error");
      }
      if (event.key === "Escape" && !loading) {
        event.preventDefault();
        close(false);
      }
    });
  }

  return { open, close, downloadWorksheet, bind };
}
