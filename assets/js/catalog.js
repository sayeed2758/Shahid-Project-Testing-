export const CLASSES = ["6","7","8","9","10"];
export const SUBJECTS = [
  { id:"sst", name:"SST", icon:"🌍" },
  { id:"science", name:"SCIENCE", icon:"🔬" },
  { id:"math", name:"MATH", icon:"🧮" },
  { id:"english", name:"ENGLISH", icon:"📚" }
];
export const SECTIONS = [
  { id:"detailed", name:"Detailed Notes", icon:"📖", protected:true },
  { id:"short", name:"Short Notes", icon:"📝", protected:true },
  { id:"worksheet", name:"Worksheet", icon:"📄", protected:false }
];

const demo = {};
for (const c of CLASSES) {
  demo[c] = {};
  for (const s of SUBJECTS) {
    demo[c][s.id] = {
      detailed: [
        { id:`${c}-${s.id}-d-1`, title:"Chapter 1 — Overview", order:1, protected:true, filePath:"" },
        { id:`${c}-${s.id}-d-2`, title:"Chapter 2 — Core Concepts", order:2, protected:true, filePath:"" }
      ],
      short: [
        { id:`${c}-${s.id}-s-1`, title:"Chapter 1 — Quick Revision", order:1, protected:true, filePath:"" },
        { id:`${c}-${s.id}-s-2`, title:"Chapter 2 — Exam Points", order:2, protected:true, filePath:"" }
      ],
      worksheet: [
        { id:`${c}-${s.id}-w-1`, title:"Worksheet 1", order:1, protected:false, filePath:"" },
        { id:`${c}-${s.id}-w-2`, title:"Practice Worksheet", order:2, protected:false, filePath:"" }
      ]
    };
  }
}
export const DEMO_CATALOG = demo;

export function normalizeCatalog(raw) {
  const out = {};
  for (const c of CLASSES) {
    out[c] = {};
    for (const s of SUBJECTS) {
      out[c][s.id] = {};
      for (const sec of SECTIONS) {
        const items = raw?.[c]?.[s.id]?.[sec.id];
        out[c][s.id][sec.id] = Array.isArray(items) ? items : DEMO_CATALOG[c][s.id][sec.id];
      }
    }
  }
  return out;
}

export function allItems(catalog) {
  const rows = [];
  for (const c of CLASSES)
    for (const s of SUBJECTS)
      for (const sec of SECTIONS)
        for (const item of (catalog?.[c]?.[s.id]?.[sec.id] || []))
          rows.push({ ...item, classId:c, subjectId:s.id, sectionId:sec.id });
  return rows;
}
