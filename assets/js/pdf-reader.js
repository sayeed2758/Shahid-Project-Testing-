import { auth } from "./firebase-init.js";
import { DRIVE_GATEWAY_URL } from "./drive-config.js";

const LOAD_TIMEOUT = 30_000;

function normaliseDriveFileId(value) {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

function gatewayUrl(material) {
  if (!DRIVE_GATEWAY_URL) throw new Error("DRIVE_GATEWAY_NOT_CONFIGURED");
  const id = normaliseDriveFileId(material?.driveFileId);
  if (!id) throw new Error("PDF_FILE_ID_MISSING");
  const section = String(material?.section || "").toLowerCase() === "worksheet" ? "worksheet" : "pdf";
  return `${DRIVE_GATEWAY_URL.replace(/\/$/, "")}/${section}/${encodeURIComponent(id)}`;
}

async function fetchProtectedPdf(material) {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");

  const token = await user.getIdToken();
  const response = await fetch(gatewayUrl(material), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let data = null;
    try { data = await response.json(); } catch {}
    const error = new Error(data?.message || `PDF request failed (${response.status})`);
    error.code = data?.code || (response.status === 403 ? "PDF_ACCESS_DENIED" : "PDF_LOAD_FAILED");
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new Error("PDF_INVALID_RESPONSE");
  }
  return response.blob();
}

export function createProtectedReaderController(elements, { onBusyChange = () => {} } = {}) {
  const paper = elements.readerCanvas?.closest(".reader-paper") || elements.readerCanvas?.parentElement;
  let iframe = null;
  let loading = false;
  let currentMaterial = null;
  let loadTimer = null;
  let objectUrl = "";

  function setStatus(message = "", type = "") {
    elements.readerStatus.textContent = message;
    elements.readerStatus.className = `reader-status ${type}`.trim();
  }

  function updateControls() {
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

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    }
  }

  function cleanupFrame() {
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
    if (iframe) {
      iframe.src = "about:blank";
      iframe.remove();
      iframe = null;
    }
    revokeObjectUrl();
    if (elements.readerCanvas) elements.readerCanvas.hidden = true;
  }

  function buildFrame(material) {
    if (!paper) throw new Error("PDF_READER_CONTAINER_MISSING");
    cleanupFrame();
    iframe = document.createElement("iframe");
    iframe.className = "reader-drive-frame";
    iframe.title = material.title || "Learning material";
    iframe.setAttribute("allow", "autoplay");
    iframe.setAttribute("loading", "eager");
    iframe.setAttribute("referrerpolicy", "no-referrer");
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
    setStatus("Loading protected PDF…", "loading");
    updateControls();
    onBusyChange(true);

    try {
      const frame = buildFrame(material);
      const blob = await Promise.race([
        fetchProtectedPdf(material),
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("PDF_LOAD_TIMEOUT"), { code: "PDF_LOAD_TIMEOUT" })), LOAD_TIMEOUT)),
      ]);

      if (!loading) return;
      objectUrl = URL.createObjectURL(blob);
      frame.addEventListener("load", () => {
        if (!loading) return;
        if (loadTimer) clearTimeout(loadTimer);
        loadTimer = null;
        loading = false;
        elements.readerRetry.hidden = false;
        setStatus("PDF ready. Download/print controls are not exposed by the portal.", "success");
        updateControls();
        onBusyChange(false);
      }, { once: true });
      frame.src = objectUrl;
      loadTimer = setTimeout(() => {
        if (!loading) return;
        loading = false;
        elements.readerRetry.hidden = false;
        setStatus("The PDF could not be displayed. Please retry.", "error");
        updateControls();
        onBusyChange(false);
      }, LOAD_TIMEOUT);
    } catch (error) {
      loading = false;
      elements.readerRetry.hidden = false;
      const message = error?.code === "PDF_ACCESS_DENIED"
        ? "You are not authorised to access this material."
        : error?.code === "DRIVE_GATEWAY_NOT_CONFIGURED"
          ? "The secure PDF gateway is not configured yet."
          : error?.code === "PDF_LOAD_TIMEOUT"
            ? "The PDF is taking too long to load. Check your connection and retry."
            : "The PDF could not be loaded. Please retry.";
      setStatus(message, "error");
      updateControls();
      onBusyChange(false);
      throw error;
    }
  }

  function close(force = false) {
    if (loading && !force) loading = false;
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
    if (!material?.driveFileId) throw new Error("PDF_FILE_ID_MISSING");
    const blob = await fetchProtectedPdf(material);
    const safeName = String(material.title || "learning-material")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "learning-material";
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeName}.pdf`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
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
