import { database } from "./firebase-init.js";
import { get, ref } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

export const SUBJECTS = [
  { id: "sst", label: "SST", icon: "🌍", description: "Social Studies" },
  { id: "science", label: "Science", icon: "🔬", description: "Science & discovery" },
  { id: "math", label: "Math", icon: "🧮", description: "Numbers & problem solving" },
  { id: "english", label: "English", icon: "📚", description: "Language & literature" },
];
export const SECTIONS = [
  { id: "detailed", label: "Detailed Notes", icon: "▤", tone: "notes" },
  { id: "short", label: "Short Notes", icon: "▥", tone: "notes" },
  { id: "worksheet", label: "Worksheet", icon: "⇩", tone: "worksheet" },
];
const normaliseClass = value => { const n = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10); return Number.isInteger(n) && n >= 6 && n <= 10 ? n : null; };
const validSubject = value => SUBJECTS.some(x => x.id === String(value).toLowerCase()) ? String(value).toLowerCase() : null;
const validSection = value => SECTIONS.some(x => x.id === String(value).toLowerCase()) ? String(value).toLowerCase() : null;
function withTimeout(promise, ms=12000){return Promise.race([promise,new Promise((_,r)=>setTimeout(()=>r(new Error("NETWORK_TIMEOUT")),ms))]);}
function normaliseMaterial(id, raw={}, classNumber){
  const cls=normaliseClass(raw.class)||classNumber, subject=validSubject(raw.subject), section=validSection(raw.section);
  const driveFileId=String(raw.driveFileId||"").trim();
  const storagePath=String(raw.storagePath||"").trim();
  if(!cls||!subject||!section||raw.active===false||(!driveFileId&&!storagePath))return null;
  return {id:String(id),title:String(raw.title||"Untitled Material").trim(),chapter:String(raw.chapter||"").trim(),class:cls,subject,section,driveFileId,storagePath,fileName:String(raw.fileName||raw.driveName||"PDF"),fileSize:Number(raw.fileSize)||0,type:"pdf",active:true,createdAt:Number(raw.createdAt)||0,updatedAt:Number(raw.updatedAt)||Number(raw.createdAt)||0};
}
let cachedClassCatalog=new Map();
export async function loadClassCatalog(classNumber,{force=false}={}){
  const cls=normaliseClass(classNumber); if(!cls)throw new Error("INVALID_CLASS");
  if(!force&&cachedClassCatalog.has(cls))return cachedClassCatalog.get(cls);
  const snap=await withTimeout(get(ref(database,`publishedCatalog/class-${cls}`))); const value=snap.val()||{};
  const materials=Object.entries(value).map(([id,raw])=>normaliseMaterial(id,raw,cls)).filter(Boolean);
  materials.sort((a,b)=>(b.updatedAt-a.updatedAt)||a.title.localeCompare(b.title,undefined,{sensitivity:"base"}));
  cachedClassCatalog.set(cls,materials); return materials;
}
export async function getMaterial(classNumber,materialId){return (await loadClassCatalog(classNumber)).find(m=>m.id===String(materialId))||null;}
export async function getCatalogSummary(classNumber){const m=await loadClassCatalog(classNumber);const sections=Object.fromEntries(SECTIONS.map(s=>[s.id,0]));const subjects=Object.fromEntries(SUBJECTS.map(s=>[s.id,0]));m.forEach(x=>{sections[x.section]++;subjects[x.subject]++;});return{total:m.length,protectedNotes:sections.detailed+sections.short,worksheets:sections.worksheet,subjectCounts:subjects,sectionCounts:sections};}
export function invalidateCatalogCache(classNumber=null){classNumber===null?cachedClassCatalog.clear():cachedClassCatalog.delete(normaliseClass(classNumber));}
export const getSubject=id=>SUBJECTS.find(x=>x.id===id)||null;
export const getSection=id=>SECTIONS.find(x=>x.id===id)||null;
export function formatFileSize(bytes){const n=Number(bytes)||0;if(!n)return"PDF";if(n<1048576)return`${Math.max(1,Math.round(n/1024))} KB`;return`${(n/1048576).toFixed(1)} MB`;}
export function formatMaterialDate(ts){if(!ts)return"Date unavailable";const d=new Date(ts);if(Number.isNaN(d.getTime()))return"Date unavailable";return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(d);}
