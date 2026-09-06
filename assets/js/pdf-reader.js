import { auth } from "./firebase-init.js";

const LOAD_TIMEOUT = 30_000;

function normaliseDriveFileId(value) {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

function drivePreviewUrl(fileId) {
  const id = normaliseDriveFileId(fileId);
  if (!id) throw new Error("PDF_FILE_ID_MISSING");
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview?rm=minimal`;
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
    // Direct Drive preview owns page navigation and zoom. Keep only app-level actions visible.
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
      iframe.src = "about:blank";
      iframe.remove();
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
      frame.src = drivePreviewUrl(material.driveFileId);
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

  async function downloadWorksheet() {
    throw new Error("WORKSHEET_DOWNLOAD_DISABLED");
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
