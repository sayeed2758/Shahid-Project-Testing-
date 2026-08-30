import { storage } from "./firebase-init.js";
import { ref as storageRef, getBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const PDFJS_VERSION = "4.10.38";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDF_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const LOAD_TIMEOUT = 75_000;

let pdfjsLibPromise = null;

function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(PDFJS_URL).then((module) => {
      module.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
      return module;
    });
  }
  return pdfjsLibPromise;
}

function withTimeout(promise, ms = LOAD_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("PDF_LOAD_TIMEOUT")), ms)
    ),
  ]);
}

function safeFileName(name) {
  return String(name || "document.pdf").replace(/[\\/:*?"<>|]+/g, "_");
}

async function fetchPdfBytes(storagePath) {
  if (!storagePath) throw new Error("PDF_PATH_MISSING");
  const fileRef = storageRef(storage, storagePath);
  return withTimeout(getBytes(fileRef, MAX_PDF_BYTES));
}

async function fetchWorksheetUrl(storagePath) {
  if (!storagePath) throw new Error("PDF_PATH_MISSING");
  const fileRef = storageRef(storage, storagePath);
  return withTimeout(getDownloadURL(fileRef), LOAD_TIMEOUT);
}

export function createProtectedReaderController(elements, { onBusyChange = () => {} } = {}) {
  const state = {
    pdf: null,
    page: 1,
    scale: 1,
    loading: false,
    currentMaterial: null,
  };

  let renderToken = 0;

  function setStatus(message = "", type = "") {
    elements.readerStatus.textContent = message;
    elements.readerStatus.className = `reader-status ${type}`.trim();
  }

  function updateControls() {
    const total = state.pdf?.numPages || 0;
    elements.readerPage.textContent = total ? `${state.page} / ${total}` : "—";
    elements.readerPrev.disabled = !state.pdf || state.page <= 1 || state.loading;
    elements.readerNext.disabled = !state.pdf || state.page >= total || state.loading;
    elements.readerZoomOut.disabled = !state.pdf || state.loading;
    elements.readerZoomIn.disabled = !state.pdf || state.loading;
    elements.readerClose.disabled = state.loading;
  }

  async function renderPage() {
    if (!state.pdf) return;
    const localToken = ++renderToken;
    const page = await state.pdf.getPage(state.page);
    if (localToken !== renderToken) return;

    const viewport = page.getViewport({ scale: state.scale });
    const canvas = elements.readerCanvas;
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.min(viewport.width, 100)}px`;

    await page.render({ canvasContext: context, viewport }).promise;

    // Subtle per-student watermark is rendered with the page view.
    const watermark = elements.readerWatermark;
    watermark.textContent = state.currentMaterial?.watermark || "";
    watermark.hidden = !state.currentMaterial?.watermark;
  }

  async function changePage(delta) {
    if (!state.pdf || state.loading) return;
    const next = state.page + delta;
    if (next < 1 || next > state.pdf.numPages) return;
    state.page = next;
    updateControls();
    try {
      await renderPage();
    } catch (error) {
      console.error(error);
      setStatus("This page could not be rendered. Retry by reopening the material.", "error");
    }
  }

  async function changeZoom(delta) {
    if (!state.pdf || state.loading) return;
    state.scale = Math.min(2.25, Math.max(.65, Number((state.scale + delta).toFixed(2))));
    elements.readerZoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
    try {
      await renderPage();
    } catch (error) {
      console.error(error);
      setStatus("Zoom could not be applied.", "error");
    }
  }

  async function open(material, watermarkText) {
    close(false);

    state.loading = true;
    state.currentMaterial = { ...material, watermark: watermarkText };
    state.page = 1;
    state.scale = 1;

    elements.readerTitle.textContent = material.title || "Protected Notes";
    elements.readerZoomLabel.textContent = "100%";
    elements.readerPage.textContent = "—";
    elements.readerCanvas.removeAttribute("width");
    elements.readerCanvas.removeAttribute("height");
    elements.readerCanvas.style.width = "";
    elements.readerCanvas.style.height = "";
    elements.readerWatermark.hidden = !watermarkText;
    elements.readerModal.hidden = false;
    document.body.classList.add("reader-open");
    updateControls();
    setStatus("Loading notes securely…", "loading");
    onBusyChange(true);

    try {
      const [pdfjs, bytes] = await Promise.all([
        loadPdfJs(),
        fetchPdfBytes(material.storagePath),
      ]);

      const loadingTask = pdfjs.getDocument({
        data: bytes,
        disableAutoFetch: false,
        disableStream: false,
      });

      state.pdf = await withTimeout(loadingTask.promise, LOAD_TIMEOUT);

      if (!state.pdf.numPages) throw new Error("PDF_EMPTY");
      updateControls();
      setStatus(`${state.pdf.numPages} page${state.pdf.numPages === 1 ? "" : "s"} ready.`, "success");
      await renderPage();
    } catch (error) {
      console.error("Protected PDF reader error:", error);
      state.pdf = null;
      updateControls();

      const message = (() => {
        if (error?.message === "PDF_LOAD_TIMEOUT") return "Loading timed out. Check your connection and retry.";
        if (error?.message === "PDF_EMPTY") return "This PDF contains no readable pages.";
        if (error?.message === "PDF_PATH_MISSING") return "This material has no storage path.";
        if (String(error?.code || "").includes("storage/unauthorized")) return "You are not authorised to open this material.";
        return "The protected reader could not open this PDF.";
      })();

      setStatus(message, "error");
      elements.readerRetry.hidden = false;
      elements.readerRetry.disabled = false;
    } finally {
      state.loading = false;
      onBusyChange(false);
      updateControls();
    }
  }

  function close(clear = true) {
    renderToken++;
    if (clear && state.loading) return;

    if (state.pdf) {
      try { state.pdf.cleanup(); } catch {}
      try { state.pdf.destroy(); } catch {}
    }
    state.pdf = null;
    state.currentMaterial = null;
    state.loading = false;

    elements.readerModal.hidden = true;
    elements.readerRetry.hidden = true;
    elements.readerCanvas.getContext("2d")?.clearRect(0, 0, elements.readerCanvas.width, elements.readerCanvas.height);
    elements.readerCanvas.width = 1;
    elements.readerCanvas.height = 1;
    document.body.classList.remove("reader-open");
    setStatus("");
    updateControls();
    onBusyChange(false);
  }

  async function retry() {
    if (!state.currentMaterial) return;
    const material = { ...state.currentMaterial };
    const watermark = material.watermark;
    delete material.watermark;
    await open(material, watermark);
  }

  async function downloadWorksheet(material) {
    const url = await fetchWorksheetUrl(material.storagePath);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFileName(material.fileName || `${material.title || "worksheet"}.pdf`);
    anchor.target = "_blank";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function bind() {
    elements.readerPrev.addEventListener("click", () => changePage(-1));
    elements.readerNext.addEventListener("click", () => changePage(1));
    elements.readerZoomOut.addEventListener("click", () => changeZoom(-.15));
    elements.readerZoomIn.addEventListener("click", () => changeZoom(.15));
    elements.readerClose.addEventListener("click", () => close(false));
    elements.readerRetry.addEventListener("click", retry);

    elements.readerModal.addEventListener("click", (event) => {
      if (event.target === elements.readerModal && !state.loading) close(false);
    });

    ["contextmenu", "dragstart", "selectstart"].forEach((type) => {
      elements.readerModal.addEventListener(type, (event) => event.preventDefault());
    });

    document.addEventListener("keydown", (event) => {
      if (elements.readerModal.hidden) return;

      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["p", "s", "u"].includes(key)) {
        event.preventDefault();
        setStatus("That action is disabled in the protected reader.", "error");
      }

      if (key === "escape" && !state.loading) {
        event.preventDefault();
        close(false);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changePage(-1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        changePage(1);
      }
    });

    window.addEventListener("beforeprint", () => {
      if (!elements.readerModal.hidden) {
        document.body.classList.add("block-print");
      }
    });
  }

  return { open, close, downloadWorksheet, bind };
}
