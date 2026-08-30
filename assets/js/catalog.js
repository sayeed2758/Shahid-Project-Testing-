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

const CLASS_MIN = 6;
const CLASS_MAX = 10;

let cachedClassCatalog = new Map();

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms)
    ),
  ]);
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function normaliseClass(value) {
  const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isInteger(number) && number >= CLASS_MIN && number <= CLASS_MAX ? number : null;
}

function normaliseSection(value) {
  const section = cleanString(value).toLowerCase();
  return SECTIONS.some((entry) => entry.id === section) ? section : null;
}

function normaliseSubject(value) {
  const subject = cleanString(value).toLowerCase();
  return SUBJECTS.some((entry) => entry.id === subject) ? subject : null;
}

function normaliseMaterial(id, raw = {}, classNumber) {
  const materialClass = normaliseClass(raw.class) || classNumber;
  const subject = normaliseSubject(raw.subject);
  const section = normaliseSection(raw.section);

  if (!materialClass || !subject || !section || raw.active === false) return null;

  return {
    id: String(id),
    title: cleanString(raw.title) || "Untitled Material",
    chapter: cleanString(raw.chapter) || "",
    class: materialClass,
    subject,
    section,
    storagePath: cleanString(raw.storagePath || raw.filePath),
    fileName: cleanString(raw.fileName),
    fileSize: Number(raw.fileSize) || 0,
    type: cleanString(raw.type || "pdf").toLowerCase(),
    active: raw.active !== false,
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
  };
}

export async function loadClassCatalog(classNumber, { force = false } = {}) {
  const numericClass = normaliseClass(classNumber);
  if (!numericClass) throw new Error("INVALID_CLASS");

  if (!force && cachedClassCatalog.has(numericClass)) {
    return cachedClassCatalog.get(numericClass);
  }

  const snapshot = await withTimeout(
    get(ref(database, `catalog/class-${numericClass}`))
  );

  const value = snapshot.val() || {};
  const materials = [];

  Object.entries(value).forEach(([id, raw]) => {
    const material = normaliseMaterial(id, raw, numericClass);
    if (material) materials.push(material);
  });

  materials.sort((a, b) =>
    (b.updatedAt - a.updatedAt) ||
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  cachedClassCatalog.set(numericClass, materials);
  return materials;
}

export async function getMaterial(classNumber, materialId) {
  const materials = await loadClassCatalog(classNumber);
  return materials.find((material) => material.id === String(materialId)) || null;
}

export async function getCatalogSummary(classNumber) {
  const materials = await loadClassCatalog(classNumber);
  const subjectCounts = Object.fromEntries(SUBJECTS.map((subject) => [subject.id, 0]));
  const sectionCounts = Object.fromEntries(SECTIONS.map((section) => [section.id, 0]));

  materials.forEach((material) => {
    subjectCounts[material.subject] += 1;
    sectionCounts[material.section] += 1;
  });

  return {
    total: materials.length,
    protectedNotes: sectionCounts.detailed + sectionCounts.short,
    worksheets: sectionCounts.worksheet,
    subjectCounts,
    sectionCounts,
  };
}

export function invalidateCatalogCache(classNumber = null) {
  if (classNumber === null) cachedClassCatalog.clear();
  else cachedClassCatalog.delete(normaliseClass(classNumber));
}

export function getSubject(subjectId) {
  return SUBJECTS.find((subject) => subject.id === subjectId) || null;
}

export function getSection(sectionId) {
  return SECTIONS.find((section) => section.id === sectionId) || null;
}

export function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size <= 0) return "PDF";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function formatMaterialDate(timestamp) {
  if (!timestamp) return "Date unavailable";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
