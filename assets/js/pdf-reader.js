import { auth, storage } from "./firebase-init.js";
import { ref as storageRef, getBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";
import { DRIVE_GATEWAY_URL } from "./drive-config.js";

const PDFJS_VERSION = "4.10.38";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDF_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
const LOAD_TIMEOUT = 90_000;
let pdfjsLibPromise = null;
function loadPdfJs(){if(!pdfjsLibPromise)pdfjsLibPromise=import(PDFJS_URL).then(m=>{m.GlobalWorkerOptions.workerSrc=PDF_WORKER_URL;return m;});return pdfjsLibPromise;}
function withTimeout(promise,ms=LOAD_TIMEOUT){return Promise.race([promise,new Promise((_,r)=>setTimeout(()=>r(new Error("PDF_LOAD_TIMEOUT")),ms))]);}
function gatewayUrl(path,params={}){if(!DRIVE_GATEWAY_URL)throw new Error("DRIVE_GATEWAY_NOT_CONFIGURED");const u=new URL(path.replace(/^\//,""),`${DRIVE_GATEWAY_URL.replace(/\/$/,"")}/`);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));});return u;}
async function fetchPdfBytes(material){
  if (material?.driveFileId) {
    const token=auth.currentUser?.getIdToken?await auth.currentUser.getIdToken():null;
    if(!token)throw new Error("AUTH_REQUIRED");
    const response=await withTimeout(fetch(gatewayUrl(`/pdf/${encodeURIComponent(material.id)}`),{headers:{Authorization:`Bearer ${token}`},cache:"no-store"}),LOAD_TIMEOUT);
    if(!response.ok){let data=null;try{data=await response.json();}catch{}const error=new Error(data?.message||`PDF request failed (${response.status})`);error.code=data?.code||"PDF_REQUEST_FAILED";throw error;}
    return new Uint8Array(await response.arrayBuffer());
  }
  if (material?.storagePath) return new Uint8Array(await withTimeout(getBytes(storageRef(storage, material.storagePath), 100*1024*1024), LOAD_TIMEOUT));
  throw new Error("PDF_FILE_ID_MISSING");
}
export function createProtectedReaderController(elements,{onBusyChange=()=>{}}={}){
  const state={pdf:null,page:1,scale:1,loading:false,currentMaterial:null};let renderToken=0;
  const setStatus=(m="",t="")=>{elements.readerStatus.textContent=m;elements.readerStatus.className=`reader-status ${t}`.trim();};
  function updateControls(){const total=state.pdf?.numPages||0;elements.readerPage.textContent=total?`${state.page} / ${total}`:"—";elements.readerPrev.disabled=!state.pdf||state.page<=1||state.loading;elements.readerNext.disabled=!state.pdf||state.page>=total||state.loading;elements.readerZoomOut.disabled=!state.pdf||state.loading;elements.readerZoomIn.disabled=!state.pdf||state.loading;elements.readerClose.disabled=state.loading;}
  async function renderPage(){if(!state.pdf)return;const token=++renderToken;const page=await state.pdf.getPage(state.page);if(token!==renderToken)return;const viewport=page.getViewport({scale:state.scale});const canvas=elements.readerCanvas;canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width="100%";canvas.style.height="auto";await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;elements.readerWatermark.textContent=state.currentMaterial?.watermark||"";elements.readerWatermark.hidden=!state.currentMaterial?.watermark;}
  async function changePage(delta){if(!state.pdf||state.loading)return;const next=state.page+delta;if(next<1||next>state.pdf.numPages)return;state.page=next;updateControls();await renderPage();}
  async function changeZoom(delta){if(!state.pdf||state.loading)return;state.scale=Math.min(2.4,Math.max(.65,Number((state.scale+delta).toFixed(2))));elements.readerZoomLabel.textContent=`${Math.round(state.scale*100)}%`;await renderPage();}
  async function open(material,watermarkText){close(false);state.loading=true;state.currentMaterial={...material,watermark:watermarkText};state.page=1;state.scale=1;elements.readerTitle.textContent=material.title||"Protected Notes";elements.readerZoomLabel.textContent="100%";elements.readerPage.textContent="—";elements.readerModal.hidden=false;document.body.classList.add("reader-open");elements.readerRetry.hidden=true;setStatus("Loading notes securely…","loading");updateControls();onBusyChange(true);try{const [pdfjs,bytes]=await Promise.all([loadPdfJs(),fetchPdfBytes(material)]);state.pdf=await withTimeout(pdfjs.getDocument({data:bytes,disableAutoFetch:false,disableStream:false}).promise);if(!state.pdf.numPages)throw new Error("PDF_EMPTY");updateControls();setStatus(`${state.pdf.numPages} page${state.pdf.numPages===1?"":"s"} ready.` ,"success");await renderPage();}catch(error){console.error(error);state.pdf=null;elements.readerRetry.hidden=false;const msg=error.message==="DRIVE_GATEWAY_NOT_CONFIGURED"?"PDF gateway is not configured yet.":error.message==="PDF_LOAD_TIMEOUT"?"Loading timed out. Check your connection and retry.":error.code==="PDF_ACCESS_DENIED"?"You are not authorised to open this material.":"The protected reader could not open this PDF.";setStatus(msg,"error");}finally{state.loading=false;onBusyChange(false);updateControls();}}
  function close(clear=true){renderToken++;if(clear&&state.loading)return;try{state.pdf?.cleanup();state.pdf?.destroy();}catch{}state.pdf=null;state.currentMaterial=null;state.loading=false;elements.readerModal.hidden=true;elements.readerRetry.hidden=true;const ctx=elements.readerCanvas.getContext("2d");try{ctx?.clearRect(0,0,elements.readerCanvas.width,elements.readerCanvas.height);}catch{}elements.readerCanvas.width=1;elements.readerCanvas.height=1;document.body.classList.remove("reader-open");setStatus("");updateControls();onBusyChange(false);}
  async function retry(){if(!state.currentMaterial)return;const m={...state.currentMaterial};const watermark=m.watermark;delete m.watermark;await open(m,watermark);}
  async function downloadWorksheet(material){
  if(!material?.id)throw new Error("MATERIAL_MISSING");
  let blob;
  if(material.driveFileId){if(!auth.currentUser)throw new Error("AUTH_REQUIRED");const token=await auth.currentUser.getIdToken();const u=gatewayUrl(`/worksheet/${encodeURIComponent(material.id)}`);const response=await fetch(u,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});if(!response.ok)throw new Error("WORKSHEET_DOWNLOAD_FAILED");blob=await response.blob();}
  else if(material.storagePath){blob=new Blob([await getBytes(storageRef(storage,material.storagePath),100*1024*1024)],{type:"application/pdf"});}
  else throw new Error("MATERIAL_SOURCE_MISSING");
  const objectUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=objectUrl;a.download=material.fileName||`${material.title||"worksheet"}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
  function bind(){elements.readerPrev.addEventListener("click",()=>changePage(-1));elements.readerNext.addEventListener("click",()=>changePage(1));elements.readerZoomOut.addEventListener("click",()=>changeZoom(-.15));elements.readerZoomIn.addEventListener("click",()=>changeZoom(.15));elements.readerClose.addEventListener("click",()=>close(false));elements.readerRetry.addEventListener("click",retry);elements.readerModal.addEventListener("click",e=>{if(e.target===elements.readerModal&&!state.loading)close(false);});["contextmenu","dragstart","selectstart"].forEach(t=>elements.readerModal.addEventListener(t,e=>e.preventDefault()));document.addEventListener("keydown",e=>{if(elements.readerModal.hidden)return;const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&["p","s","u"].includes(k)){e.preventDefault();setStatus("That action is disabled in the protected reader.","error");}if(k==="escape"&&!state.loading){e.preventDefault();close(false);}if(e.key==="ArrowLeft")changePage(-1);if(e.key==="ArrowRight")changePage(1);});}
  return {open,close,downloadWorksheet,bind};
}
